import { useState, useRef, useCallback, useEffect } from 'react'
import { pluckStringAt, pluckMutedAt, strumMutedAt, stopAllNodes } from '../audio/karplusStrong'
import audioEngine from '../audio/AudioEngine'
import type { ChordPosition } from '../types/chord'
import { OPEN_STRING_FREQS } from '../types/chord'
import type { ArpeggioPattern, ArpeggioState } from '../types/audio'

// ─── 指法节奏型 ──────────────────────────────────────────────
// 弦编号（吉他标准）: 1=高音E(idx5)  2=B(idx4)  3=G(idx3)
//                    4=D(idx2)       5=A(idx1)   6=低音E(idx0)
//
// 特殊标记: -2 = 闷弦扫（x 节拍）

// 53231323: 5弦(A)作低音 + G-B-G-高E-G-B-G
const PATTERN_53231323: number[] = [1, 3, 4, 3, 5, 3, 4, 3]

// x3231323: 闷弦 + 3231323（切音版）
const PATTERN_X3231323: number[] = [-2, 3, 4, 3, 5, 3, 4, 3]

// 扫弦 DDUUDU 节拍表: { dir, vel }
type StrumBeat = { dir: 'down' | 'up'; vel: number }
const STRUM_BEATS: StrumBeat[] = [
  { dir: 'down', vel: 1.0 },
  { dir: 'down', vel: 0.7 },
  { dir: 'up',   vel: 0.55 },
  { dir: 'up',   vel: 0.5 },
  { dir: 'down', vel: 0.85 },
  { dir: 'up',   vel: 0.5 },
]
const SWEEP_DURATION = 0.055  // 55ms 扫完所有弦

// ─── 音量配置 ────────────────────────────────────────────────
const BASS_VOL = 0.9   // 低音弦（第一步）更响
const TREBLE_VOL = 0.55

// ─────────────────────────────────────────────────────────────

export function useArpeggio() {
  const [arpeggioState, setArpeggioState] = useState<ArpeggioState>({
    isPlaying: false,
    bpm: 80,
    pattern: '53231323',
    activeString: null,
    isStrumBeat: false,
  })

  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextTimeRef   = useRef(0)
  const stepRef       = useRef(0)
  const positionRef   = useRef<ChordPosition | null>(null)
  const patternRef    = useRef<ArpeggioPattern>('53231323')
  const bpmRef        = useRef(80)
  const genRef        = useRef(0)  // generation counter：stop 时递增，作废旧 setTimeout

  // ─── 指法单音 ───────────────────────────────────────────────
  const scheduleArpeggioNote = useCallback((stringIndex: number, time: number, isBass: boolean, gen: number) => {
    const pos = positionRef.current
    if (!pos) return

    if (stringIndex === -2) {
      // x 闷弦节拍
      strumMutedAt(pos, time)
      const delayMs = Math.max(0, (time - audioEngine.getContext().currentTime) * 1000)
      setTimeout(() => {
        if (genRef.current !== gen) return
        setArpeggioState(s => ({ ...s, activeString: null, isStrumBeat: true }))
        setTimeout(() => {
          if (genRef.current !== gen) return
          setArpeggioState(s => ({ ...s, isStrumBeat: false }))
        }, 180)
      }, delayMs)
      return
    }

    const fret = pos.frets[stringIndex]
    if (fret === -1) return

    const freq = OPEN_STRING_FREQS[stringIndex] * Math.pow(2, fret / 12)
    const vol = isBass ? BASS_VOL : TREBLE_VOL
    pluckStringAt(freq, time, vol)

    const delayMs = Math.max(0, (time - audioEngine.getContext().currentTime) * 1000)
    setTimeout(() => {
      if (genRef.current !== gen) return
      setArpeggioState(s => ({ ...s, activeString: stringIndex, isStrumBeat: false }))
      setTimeout(() => {
        if (genRef.current !== gen) return
        setArpeggioState(s => ({ ...s, activeString: null }))
      }, 170)
    }, delayMs)
  }, [])

  // ─── 扫弦节拍 ────────────────────────────────────────────────
  const scheduleStrum = useCallback((beat: StrumBeat, beatTime: number, gen: number) => {
    const pos = positionRef.current
    if (!pos) return

    const strings = beat.dir === 'down' ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0]
    const delayPerStr = SWEEP_DURATION / 5

    strings.forEach((strIndex, i) => {
      const fret = pos.frets[strIndex]
      if (fret === -1) return
      const freq = OPEN_STRING_FREQS[strIndex] * Math.pow(2, fret / 12)
      // 上扫音量更小、高音弦稍强（模拟真实拨片动感）
      const vol = beat.dir === 'down'
        ? beat.vel * (0.6 + i * 0.01)
        : beat.vel * (0.55 - i * 0.01)
      pluckStringAt(freq, beatTime + i * delayPerStr, vol)
    })

    // 扫弦用整体节拍闪光，不做逐弦高亮
    const beatMs = Math.max(0, (beatTime - audioEngine.getContext().currentTime) * 1000)
    const flashDuration = Math.min((60 / bpmRef.current) * 700, 280)
    setTimeout(() => {
      if (genRef.current !== gen) return
      setArpeggioState(s => ({ ...s, isStrumBeat: true, activeString: null }))
      setTimeout(() => {
        if (genRef.current !== gen) return
        setArpeggioState(s => ({ ...s, isStrumBeat: false }))
      }, flashDuration)
    }, beatMs)
  }, [])

  // ─── 调度器（每 25ms 看前方 100ms）─────────────────────────
  const schedulerTick = useCallback(() => {
    const ctx = audioEngine.getContext()
    const lookahead = 0.1
    const gen = genRef.current
    const pattern = patternRef.current
    const bpm = bpmRef.current

    if (pattern === 'strum') {
      const secPerBeat = 60 / bpm
      while (nextTimeRef.current < ctx.currentTime + lookahead) {
        scheduleStrum(STRUM_BEATS[stepRef.current % STRUM_BEATS.length], nextTimeRef.current, gen)
        nextTimeRef.current += secPerBeat
        stepRef.current++
      }
    } else {
      const arpPattern = pattern === '53231323' ? PATTERN_53231323 : PATTERN_X3231323
      const secPerStep = 60 / bpm / 2  // 8分音符
      while (nextTimeRef.current < ctx.currentTime + lookahead) {
        const step = stepRef.current % arpPattern.length
        const isBass = step === 0
        scheduleArpeggioNote(arpPattern[step], nextTimeRef.current, isBass, gen)
        nextTimeRef.current += secPerStep
        stepRef.current++
      }
    }
  }, [scheduleArpeggioNote, scheduleStrum])

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    genRef.current++
    stopAllNodes()
    setArpeggioState(s => ({ ...s, isPlaying: false, activeString: null, isStrumBeat: false }))
  }, [])

  const play = useCallback((position: ChordPosition, pattern: ArpeggioPattern, bpm: number) => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    genRef.current++
    stopAllNodes()

    positionRef.current = position
    patternRef.current  = pattern
    bpmRef.current      = bpm
    stepRef.current     = 0

    audioEngine.resume()
    nextTimeRef.current = audioEngine.getContext().currentTime + 0.05
    setArpeggioState({ isPlaying: true, bpm, pattern, activeString: null, isStrumBeat: false })
    intervalRef.current = setInterval(schedulerTick, 25)
  }, [schedulerTick])

  useEffect(() => () => stop(), [stop])

  return { arpeggioState, play, stop }
}
