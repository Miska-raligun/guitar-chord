import { useState, useRef, useCallback, useEffect } from 'react'
import { pluckStringAt } from '../audio/karplusStrong'
import audioEngine from '../audio/AudioEngine'
import type { ChordPosition, } from '../types/chord'
import { OPEN_STRING_FREQS } from '../types/chord'
import type { ArpeggioPattern, ArpeggioState } from '../types/audio'

const ARPEGGIO_PATTERNS: Record<ArpeggioPattern, number[]> = {
  folk:      [0, 1, 2, 3, 2, 3],
  classical: [0, 3, 4, 5, 4, 5],
  pop:       [0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0],
}

export function useArpeggio() {
  const [arpeggioState, setArpeggioState] = useState<ArpeggioState>({
    isPlaying: false,
    bpm: 80,
    pattern: 'folk',
    activeString: null,
  })

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextNoteTimeRef = useRef(0)
  const stepRef = useRef(0)
  const positionRef = useRef<ChordPosition | null>(null)
  const patternRef = useRef<ArpeggioPattern>('folk')
  const bpmRef = useRef(80)

  const scheduleNote = useCallback((stringIndex: number, time: number) => {
    const pos = positionRef.current
    if (!pos) return
    const fret = pos.frets[stringIndex]
    if (fret === -1) return // muted

    const freq = OPEN_STRING_FREQS[stringIndex] * Math.pow(2, fret / 12)
    pluckStringAt(freq, time)

    const delay = (time - audioEngine.getContext().currentTime) * 1000
    setTimeout(() => {
      setArpeggioState(s => ({ ...s, activeString: stringIndex }))
      setTimeout(() => setArpeggioState(s => ({ ...s, activeString: null })), 150)
    }, Math.max(0, delay))
  }, [])

  const schedulerTick = useCallback(() => {
    const ctx = audioEngine.getContext()
    const pattern = ARPEGGIO_PATTERNS[patternRef.current]
    const secondsPerBeat = 60 / bpmRef.current / 2 // 8th notes

    while (nextNoteTimeRef.current < ctx.currentTime + 0.1) {
      const step = stepRef.current % pattern.length
      scheduleNote(pattern[step], nextNoteTimeRef.current)
      nextNoteTimeRef.current += secondsPerBeat
      stepRef.current++
    }
  }, [scheduleNote])

  const play = useCallback((position: ChordPosition, pattern: ArpeggioPattern, bpm: number) => {
    positionRef.current = position
    patternRef.current = pattern
    bpmRef.current = bpm
    stepRef.current = 0
    audioEngine.resume()
    nextNoteTimeRef.current = audioEngine.getContext().currentTime + 0.05
    setArpeggioState({ isPlaying: true, bpm, pattern, activeString: null })
    intervalRef.current = setInterval(schedulerTick, 25)
  }, [schedulerTick])

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setArpeggioState(s => ({ ...s, isPlaying: false, activeString: null }))
  }, [])

  useEffect(() => () => stop(), [stop])

  return { arpeggioState, play, stop }
}
