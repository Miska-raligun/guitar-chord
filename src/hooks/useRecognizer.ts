import { useState, useRef, useCallback, useEffect } from 'react'
import { extractChromagram } from '../audio/chromagram'
import { detectChords } from '../audio/chordDetector'
import { useChordDb } from './useChordDb'
import audioEngine from '../audio/AudioEngine'
import type { ChordMatch } from '../types/audio'

interface RecognizerState {
  isListening: boolean
  matches: ChordMatch[]
  error: string | null
}

// Read FFT at 200ms intervals — 5 Hz is plenty for chord tracking and eliminates UI flicker
const DETECT_MS     = 200
// Same top chord must appear N times before the display switches
const STABLE_NEEDED = 2
// N consecutive silent ticks (N × DETECT_MS ms) before clearing the display
const SILENCE_CLEAR = 6

export function useRecognizer() {
  const [state, setState] = useState<RecognizerState>({
    isListening: false,
    matches: [],
    error: null,
  })

  const { getChordEntry } = useChordDb()

  // Audio nodes
  const streamRef   = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef   = useRef<MediaStreamAudioSourceNode | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const freqDataRef = useRef<Float32Array<ArrayBuffer> | null>(null)

  // Stability / silence tracking
  const pendingKeyRef   = useRef('')
  const stableCountRef  = useRef(0)
  const silenceCountRef = useRef(0)
  const lastKeyRef      = useRef('')

  const tick = useCallback(() => {
    const analyser = analyserRef.current
    const freqData  = freqDataRef.current
    if (!analyser || !freqData) return

    // Shared AudioContext can be suspended by the browser (iOS power saving, tab switch).
    // Resume it and skip this tick; next tick will have fresh data.
    const ctx = audioEngine.getContext()
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
      return
    }

    analyser.getFloatFrequencyData(freqData)
    const chromagram = extractChromagram(freqData, ctx.sampleRate)

    // extractChromagram returns zeros when there is no meaningful signal
    const energy = Math.max(...chromagram)

    if (energy > 0.05) {
      silenceCountRef.current = 0
      const rawMatches = detectChords(chromagram, 3)
      if (rawMatches.length === 0) return

      const topKey = `${rawMatches[0].root}-${rawMatches[0].suffix}`

      if (topKey === pendingKeyRef.current) {
        stableCountRef.current++
      } else {
        pendingKeyRef.current = topKey
        stableCountRef.current = 1
      }

      // Update display only when the top chord has stabilised and actually changed
      if (stableCountRef.current >= STABLE_NEEDED && topKey !== lastKeyRef.current) {
        lastKeyRef.current = topKey
        const matches = rawMatches.map(m => ({
          ...m,
          positions: getChordEntry(m.root, m.suffix)?.positions ?? [],
        }))
        setState(s => ({ ...s, matches }))
      }
    } else {
      silenceCountRef.current++
      if (silenceCountRef.current >= SILENCE_CLEAR) {
        silenceCountRef.current = 0
        pendingKeyRef.current   = ''
        stableCountRef.current  = 0
        lastKeyRef.current      = ''
        setState(s => s.matches.length > 0 ? { ...s, matches: [] } : s)
      }
    }
  }, [getChordEntry])

  const start = useCallback(async () => {
    setState(s => s.error ? { ...s, error: null } : s)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream

      // Reuse the shared AudioContext so it benefits from the user-gesture unlock
      // that happened when the mic permission was granted, and is less likely to be
      // silently suspended than a privately-created context.
      audioEngine.resume()
      const ctx = audioEngine.getContext()

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 8192
      analyser.smoothingTimeConstant = 0.7   // responsive but not jittery
      analyserRef.current = analyser
      freqDataRef.current = new Float32Array(analyser.frequencyBinCount)

      // Connect mic → analyser only (NOT to ctx.destination — we don't want to hear the mic)
      const source = ctx.createMediaStreamSource(stream)
      sourceRef.current = source
      source.connect(analyser)

      pendingKeyRef.current   = ''
      stableCountRef.current  = 0
      silenceCountRef.current = 0
      lastKeyRef.current      = ''

      setState({ isListening: true, matches: [], error: null })
      intervalRef.current = setInterval(tick, DETECT_MS)
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ''
      const message =
        name === 'NotAllowedError' || name === 'PermissionDeniedError'
          ? '麦克风权限被拒绝，请在浏览器设置中允许访问后重试'
          : name === 'NotFoundError'
            ? '未检测到麦克风设备'
            : '无法访问麦克风，请检查浏览器权限设置'
      setState(s => ({ ...s, error: message }))
    }
  }, [tick])

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    // Disconnect the mic source before stopping the stream track
    sourceRef.current?.disconnect()
    sourceRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current  = null
    analyserRef.current = null
    setState(s => ({ ...s, isListening: false }))
  }, [])

  useEffect(() => () => stop(), [stop])

  return { ...state, start, stop }
}
