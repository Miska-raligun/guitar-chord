import { useState, useRef, useCallback, useEffect } from 'react'
import { pluckStringAt, stopAllNodes } from '../audio/karplusStrong'
import audioEngine from '../audio/AudioEngine'
import { OPEN_STRING_FREQS } from '../types/chord'
import type { ChordPosition } from '../types/chord'
import type { ChordSlot, MelodyNote, SequencerState } from '../types/audio'
import { useChordDb } from './useChordDb'

const NUM_BARS = 8

type PatternStep = number | number[]
const BASS      = -10
const MUTE_BASS = -11
const REST      = -20
const STRUM_DOWN = -30
const STRUM_UP   = -31

const PATTERN_53231323: PatternStep[] = [BASS,      3, 4, 3, 5, 3, 4, 3]
const PATTERN_X3231323: PatternStep[] = [MUTE_BASS, 3, 4, 3, 5, 3, 4, 3]
const PATTERN_3_12_3:   PatternStep[] = [BASS, 3, [4, 5], 3]

const BASS_VOL   = 0.88
const TREBLE_VOL = 0.55
const SWEEP_DUR  = 0.055

function getPatternSteps(pat: SequencerState['pattern']): PatternStep[] {
  if (pat === '53231323') return PATTERN_53231323
  if (pat === 'x3231323') return PATTERN_X3231323
  if (pat === '3_12_3')   return PATTERN_3_12_3
  // strum: 4 quarter-note downstrokes
  return [STRUM_DOWN, STRUM_DOWN, STRUM_DOWN, STRUM_DOWN]
}

function getStepsPerBar(pat: SequencerState['pattern']): number {
  return pat === '53231323' || pat === 'x3231323' ? 8 : 4
}

function getSPerStep(pat: SequencerState['pattern'], bpm: number): number {
  return getStepsPerBar(pat) === 8 ? 60 / bpm / 2 : 60 / bpm
}

function getBassString(pos: ChordPosition): number {
  for (let i = 0; i < pos.frets.length; i++) {
    if (pos.frets[i] !== -1) return i
  }
  return 1
}

function getFreq(pos: ChordPosition, strIdx: number): number | null {
  const fret = pos.frets[strIdx]
  if (fret === -1) return null
  return OPEN_STRING_FREQS[strIdx] * Math.pow(2, fret / 12)
}

// Maps absolute semitone (0-11, C=0) to a frequency in the C4-B4 range
function semitoneToFreq(semitone: number): number {
  if (semitone >= 4) {
    // ①e string (E4), fret = semitone - 4
    return OPEN_STRING_FREQS[5] * Math.pow(2, (semitone - 4) / 12)
  } else {
    // ②B string (B3), fret = semitone + 1 gives C4..Eb4
    return OPEN_STRING_FREQS[4] * Math.pow(2, (semitone + 1) / 12)
  }
}

function makeEmptyChords(): ChordSlot[] {
  return Array.from({ length: NUM_BARS }, () => ({ root: null, suffix: null, positionIndex: 0 }))
}

function makeEmptyMelody(): (MelodyNote | null)[][] {
  return Array.from({ length: NUM_BARS }, () => Array(4).fill(null))
}

export function useSequencer() {
  const [state, setState] = useState<SequencerState>({
    bpm: 80,
    pattern: '53231323',
    keyRoot: 0,
    chords: makeEmptyChords(),
    melody: makeEmptyMelody(),
    isPlaying: false,
    currentBar: -1,
  })

  const { getChordEntry } = useChordDb()

  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextTimeRef  = useRef(0)
  const stepRef      = useRef(0)
  const genRef       = useRef(0)
  const posRef       = useRef<ChordPosition | null>(null)

  // Mutable refs kept in sync with state for use inside setInterval callbacks
  const chordsRef  = useRef(state.chords)
  const melodyRef  = useRef(state.melody)
  const patternRef = useRef(state.pattern)
  const bpmRef     = useRef(state.bpm)

  useEffect(() => { chordsRef.current = state.chords }, [state.chords])
  useEffect(() => { melodyRef.current = state.melody }, [state.melody])

  const scheduleStep = useCallback((step: PatternStep, time: number, isBass: boolean, pos: ChordPosition) => {
    if (step === REST) return

    if (step === STRUM_DOWN || step === STRUM_UP) {
      const strings = step === STRUM_DOWN ? [0,1,2,3,4,5] : [5,4,3,2,1,0]
      const dps = SWEEP_DUR / 5
      strings.forEach((si, i) => {
        const freq = getFreq(pos, si)
        if (freq === null) return
        pluckStringAt(freq, time + i * dps, 0.78)
      })
      return
    }

    if (step === BASS || step === MUTE_BASS) {
      const si   = getBassString(pos)
      const freq = getFreq(pos, si)
      if (freq === null) return
      pluckStringAt(freq, time, BASS_VOL)
      return
    }

    if (Array.isArray(step)) {
      step.forEach(si => {
        const freq = getFreq(pos, si)
        if (freq !== null) pluckStringAt(freq, time, TREBLE_VOL * 1.1)
      })
      return
    }

    const freq = getFreq(pos, step)
    if (freq !== null) pluckStringAt(freq, time, isBass ? BASS_VOL : TREBLE_VOL)
  }, [])

  const schedulerTick = useCallback(() => {
    const ctx     = audioEngine.getContext()
    const gen     = genRef.current
    const pat     = patternRef.current
    const bpm     = bpmRef.current
    const steps   = getPatternSteps(pat)
    const spb     = getStepsPerBar(pat)
    const sPerStep = getSPerStep(pat, bpm)
    const stepsPerBeat = spb / 4
    const totalSteps = NUM_BARS * spb

    while (nextTimeRef.current < ctx.currentTime + 0.1) {
      const globalStep = stepRef.current % totalSteps
      const bar        = Math.floor(globalStep / spb)
      const stepInBar  = globalStep % spb

      if (stepInBar === 0) {
        const slot = chordsRef.current[bar]
        posRef.current = (slot.root && slot.suffix)
          ? (getChordEntry(slot.root, slot.suffix)?.positions[slot.positionIndex] ?? null)
          : null

        const ms = Math.max(0, (nextTimeRef.current - ctx.currentTime) * 1000)
        setTimeout(() => {
          if (genRef.current !== gen) return
          setState(s => ({ ...s, currentBar: bar }))
        }, ms)
      }

      if (posRef.current) {
        scheduleStep(steps[stepInBar], nextTimeRef.current, stepInBar === 0, posRef.current)
      }

      // Overlay melody note at each beat boundary
      if (stepInBar % stepsPerBeat === 0) {
        const beat = stepInBar / stepsPerBeat
        const note = melodyRef.current[bar]?.[beat]
        if (note) {
          pluckStringAt(semitoneToFreq(note.semitone), nextTimeRef.current + 0.005, 0.85)
        }
      }

      nextTimeRef.current += sPerStep
      stepRef.current++
    }
  }, [scheduleStep, getChordEntry])

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    genRef.current++
    stopAllNodes()
    setState(s => ({ ...s, isPlaying: false, currentBar: -1 }))
  }, [])

  const play = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    genRef.current++
    stopAllNodes()

    stepRef.current    = 0
    posRef.current     = null

    audioEngine.resume()
    nextTimeRef.current = audioEngine.getContext().currentTime + 0.05
    setState(s => ({ ...s, isPlaying: true, currentBar: -1 }))
    intervalRef.current = setInterval(schedulerTick, 25)
  }, [schedulerTick])

  const setChordSlot = useCallback((bar: number, slot: ChordSlot) => {
    setState(s => {
      const chords = s.chords.map((c, i) => i === bar ? slot : c)
      chordsRef.current = chords
      return { ...s, chords }
    })
  }, [])

  const setMelodyNote = useCallback((bar: number, beat: number, note: MelodyNote | null) => {
    setState(s => {
      const melody = s.melody.map((row, i) =>
        i === bar ? row.map((n, j) => j === beat ? note : n) : row
      )
      melodyRef.current = melody
      return { ...s, melody }
    })
  }, [])

  const setBpm = useCallback((bpm: number) => {
    bpmRef.current = bpm
    setState(s => ({ ...s, bpm }))
  }, [])

  const setPattern = useCallback((pattern: SequencerState['pattern']) => {
    patternRef.current = pattern
    setState(s => ({ ...s, pattern }))
  }, [])

  const setKeyRoot = useCallback((keyRoot: number) => {
    setState(s => ({ ...s, keyRoot }))
  }, [])

  useEffect(() => () => stop(), [stop])

  return { state, setChordSlot, setMelodyNote, setBpm, setPattern, setKeyRoot, play, stop }
}
