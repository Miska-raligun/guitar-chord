import { useState, useRef, useCallback, useEffect } from 'react'
import { extractChromagram } from '../audio/chromagram'
import { detectChords } from '../audio/chordDetector'
import { useChordDb } from './useChordDb'
import type { ChordMatch } from '../types/audio'

interface RecognizerState {
  isListening: boolean
  matches: ChordMatch[]
  error: string | null
}

export function useRecognizer() {
  const [state, setState] = useState<RecognizerState>({
    isListening: false,
    matches: [],
    error: null,
  })

  const { getChordEntry } = useChordDb()
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const freqDataRef = useRef<Float32Array<ArrayBuffer> | null>(null)

  const tick = useCallback(() => {
    const analyser = analyserRef.current
    const freqData = freqDataRef.current
    if (!analyser || !freqData) return

    analyser.getFloatFrequencyData(freqData)
    const chromagram = extractChromagram(freqData, audioCtxRef.current!.sampleRate)

    // Only update if there's meaningful signal (max energy > threshold)
    const energy = Math.max(...chromagram)
    if (energy > 0.05) {
      const rawMatches = detectChords(chromagram, 3)
      const matches = rawMatches.map(m => ({
        ...m,
        position: getChordEntry(m.root, m.suffix)?.positions[0] ?? null,
      }))
      setState(s => ({ ...s, matches }))
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [getChordEntry])

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream

      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 8192
      analyser.smoothingTimeConstant = 0.7
      analyserRef.current = analyser
      freqDataRef.current = new Float32Array(analyser.frequencyBinCount)

      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyser)

      setState({ isListening: true, matches: [], error: null })
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      setState(s => ({ ...s, error: '无法访问麦克风，请检查浏览器权限设置' }))
    }
  }, [tick])

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    setState(s => ({ ...s, isListening: false }))
  }, [])

  useEffect(() => () => stop(), [stop])

  return { ...state, start, stop }
}
