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

// 每 200ms 读一次 FFT（5Hz），远低于原本的 60fps RAF，彻底消除闪烁
const DETECT_MS = 200
// 连续两次读到同一首位和弦才刷新显示，防止瞬态噪声切换
const STABLE_NEEDED = 2
// 连续 N 次静音才清空显示（N × DETECT_MS ms）
const SILENCE_CLEAR = 6

export function useRecognizer() {
  const [state, setState] = useState<RecognizerState>({
    isListening: false,
    matches: [],
    error: null,
  })

  const { getChordEntry } = useChordDb()
  const streamRef    = useRef<MediaStream | null>(null)
  const audioCtxRef  = useRef<AudioContext | null>(null)
  const analyserRef  = useRef<AnalyserNode | null>(null)
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const freqDataRef  = useRef<Float32Array<ArrayBuffer> | null>(null)

  // 稳定性追踪
  const pendingKeyRef   = useRef('')   // 当前候选和弦 key
  const stableCountRef  = useRef(0)    // 候选和弦连续出现次数
  const silenceCountRef = useRef(0)    // 连续静音次数
  const lastKeyRef      = useRef('')   // 已显示的和弦 key（避免重复 setState）

  const tick = useCallback(() => {
    const analyser = analyserRef.current
    const freqData  = freqDataRef.current
    if (!analyser || !freqData) return

    analyser.getFloatFrequencyData(freqData)
    const chromagram = extractChromagram(freqData, audioCtxRef.current!.sampleRate)
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

      // 只有稳定出现 STABLE_NEEDED 次，且与当前显示不同时，才刷新
      if (stableCountRef.current >= STABLE_NEEDED && topKey !== lastKeyRef.current) {
        lastKeyRef.current = topKey
        const matches = rawMatches.map(m => ({
          ...m,
          position: getChordEntry(m.root, m.suffix)?.positions[0] ?? null,
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream

      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 8192
      analyser.smoothingTimeConstant = 0.85  // 更高平滑，让频谱更稳定
      analyserRef.current = analyser
      freqDataRef.current = new Float32Array(analyser.frequencyBinCount)

      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyser)

      pendingKeyRef.current  = ''
      stableCountRef.current = 0
      silenceCountRef.current = 0
      lastKeyRef.current     = ''

      setState({ isListening: true, matches: [], error: null })
      intervalRef.current = setInterval(tick, DETECT_MS)
    } catch {
      setState(s => ({ ...s, error: '无法访问麦克风，请检查浏览器权限设置' }))
    }
  }, [tick])

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
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
