import { useState, useRef, useCallback, useEffect } from 'react'
import { pluckStringAt, stopAllNodes } from '../audio/karplusStrong'
import audioEngine from '../audio/AudioEngine'
import type { ChordPosition } from '../types/chord'
import { OPEN_STRING_FREQS } from '../types/chord'
import type { ArpeggioPattern, ArpeggioState } from '../types/audio'

// ——— Arpeggio (finger-picking) patterns ———
// String indices: 0=低音E, 1=A, 2=D, 3=G, 4=B, 5=高音E
// Each step is one 8th note (60/bpm/2 seconds)
const ARPEGGIO_PATTERNS: Record<'folk' | 'classical', number[]> = {
  folk:      [0, 3, 4, 5, 1, 4, 5, 4],  // 交替低音(0/1) + 高弦，Travis picking feel
  classical: [0, 2, 3, 4, 5, 4, 3, 2],  // 上行再下行，古典圆弧型
}

// ——— Strum patterns ———
// Each entry: direction 'down'|'up' and relative velocity
type StrumBeat = { dir: 'down' | 'up'; vel: number }
const STRUM_BEATS: StrumBeat[] = [
  { dir: 'down', vel: 1.0 },   // beat 1
  { dir: 'down', vel: 0.7 },   // beat 2
  { dir: 'up',   vel: 0.55 },  // &
  { dir: 'down', vel: 0.85 },  // beat 3
  { dir: 'up',   vel: 0.5 },   // &
  { dir: 'down', vel: 0.75 },  // beat 4
  { dir: 'up',   vel: 0.5 },   // &
  { dir: 'down', vel: 0.65 },
]

// Sweep time: total time to drag across all 6 strings in a strum
const SWEEP_DURATION = 0.055  // 55ms from first to last string

export function useArpeggio() {
  const [arpeggioState, setArpeggioState] = useState<ArpeggioState>({
    isPlaying: false,
    bpm: 80,
    pattern: 'folk',
    activeString: null,
  })

  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextTimeRef   = useRef(0)
  const stepRef       = useRef(0)
  const positionRef   = useRef<ChordPosition | null>(null)
  const patternRef    = useRef<ArpeggioPattern>('folk')
  const bpmRef        = useRef(80)
  const generationRef = useRef(0)  // incremented on stop to cancel stale setTimeouts

  // ——— schedule one finger-pick note ———
  const scheduleArpeggioNote = useCallback((stringIndex: number, time: number, gen: number) => {
    const pos = positionRef.current
    if (!pos) return
    const fret = pos.frets[stringIndex]
    if (fret === -1) return

    const freq = OPEN_STRING_FREQS[stringIndex] * Math.pow(2, fret / 12)
    pluckStringAt(freq, time)

    const delayMs = Math.max(0, (time - audioEngine.getContext().currentTime) * 1000)
    setTimeout(() => {
      if (generationRef.current !== gen) return
      setArpeggioState(s => ({ ...s, activeString: stringIndex }))
      setTimeout(() => {
        if (generationRef.current !== gen) return
        setArpeggioState(s => ({ ...s, activeString: null }))
      }, 160)
    }, delayMs)
  }, [])

  // ——— schedule one strum beat (sweeps all strings in SWEEP_DURATION) ———
  const scheduleStrum = useCallback((beat: StrumBeat, beatTime: number, gen: number) => {
    const pos = positionRef.current
    if (!pos) return

    const strings = beat.dir === 'down' ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0]
    const delayPerString = SWEEP_DURATION / 5

    strings.forEach((strIndex, i) => {
      const fret = pos.frets[strIndex]
      if (fret === -1) return
      const freq = OPEN_STRING_FREQS[strIndex] * Math.pow(2, fret / 12)
      const noteTime = beatTime + i * delayPerString
      pluckStringAt(freq, noteTime, beat.vel * 0.68)
    })

    // Highlight middle string as a visual sweep indicator
    const midString = beat.dir === 'down' ? 2 : 3
    const midTime = beatTime + 2 * delayPerString
    const delayMs = Math.max(0, (midTime - audioEngine.getContext().currentTime) * 1000)
    setTimeout(() => {
      if (generationRef.current !== gen) return
      setArpeggioState(s => ({ ...s, activeString: midString }))
      setTimeout(() => {
        if (generationRef.current !== gen) return
        setArpeggioState(s => ({ ...s, activeString: null }))
      }, 120)
    }, delayMs)
  }, [])

  // ——— look-ahead scheduler (runs every 25ms) ———
  const schedulerTick = useCallback(() => {
    const ctx = audioEngine.getContext()
    const lookahead = 0.1  // schedule 100ms ahead
    const gen = generationRef.current
    const pattern = patternRef.current
    const bpm = bpmRef.current

    if (pattern === 'pop') {
      // Strum: quarter note per beat
      const secPerBeat = 60 / bpm
      while (nextTimeRef.current < ctx.currentTime + lookahead) {
        const step = stepRef.current % STRUM_BEATS.length
        scheduleStrum(STRUM_BEATS[step], nextTimeRef.current, gen)
        nextTimeRef.current += secPerBeat
        stepRef.current++
      }
    } else {
      // Arpeggio: 8th notes
      const secPerStep = 60 / bpm / 2
      const arpPattern = ARPEGGIO_PATTERNS[pattern]
      while (nextTimeRef.current < ctx.currentTime + lookahead) {
        const step = stepRef.current % arpPattern.length
        scheduleArpeggioNote(arpPattern[step], nextTimeRef.current, gen)
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
    generationRef.current++   // cancel all pending setTimeouts
    stopAllNodes()             // stop all scheduled AudioBufferSourceNodes
    setArpeggioState(s => ({ ...s, isPlaying: false, activeString: null }))
  }, [])

  const play = useCallback((position: ChordPosition, pattern: ArpeggioPattern, bpm: number) => {
    // Always stop previous playback before starting new one
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    generationRef.current++
    stopAllNodes()

    positionRef.current = position
    patternRef.current  = pattern
    bpmRef.current      = bpm
    stepRef.current     = 0

    audioEngine.resume()
    nextTimeRef.current = audioEngine.getContext().currentTime + 0.05
    setArpeggioState({ isPlaying: true, bpm, pattern, activeString: null })
    intervalRef.current = setInterval(schedulerTick, 25)
  }, [schedulerTick])

  useEffect(() => () => stop(), [stop])

  return { arpeggioState, play, stop }
}
