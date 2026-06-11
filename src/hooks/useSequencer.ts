import { useState, useRef, useCallback, useEffect } from 'react'
import { pluckStringAt, stopAllNodes } from '../audio/karplusStrong'
import audioEngine from '../audio/AudioEngine'
import { OPEN_STRING_FREQS } from '../types/chord'
import type { ChordPosition } from '../types/chord'
import type { ChordSlot, MelodyNote, SequencerState, TimeSig } from '../types/audio'
import { useChordDb } from './useChordDb'

const INITIAL_BARS = 8
const MAX_BARS     = 32
const MELODY_SLOTS = 8  // always store 8 eighth-note slots per bar

type PatternStep = number | number[]
const BASS       = -10
const MUTE_BASS  = -11
const REST       = -20
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
  return [STRUM_DOWN, STRUM_DOWN, STRUM_DOWN, STRUM_DOWN]
}

// Steps per bar: determined by pattern type AND time signature
// 8-step patterns (folk): 4/4→8, 3/4→6, 6/8→6, 2/4→4
// 4-step patterns (strum/classical): 4/4→4, 3/4→3, 6/8→3, 2/4→2
export function getStepsPerBar(pat: SequencerState['pattern'], timeSig: TimeSig): number {
  const is8step = pat === '53231323' || pat === 'x3231323'
  if (timeSig === '4/4') return is8step ? 8 : 4
  if (timeSig === '3/4' || timeSig === '6/8') return is8step ? 6 : 3
  return is8step ? 4 : 2  // 2/4
}

// Step duration: stepsPerBar >= 5 → eighth note, else quarter note
function getSPerStep(stepsPerBar: number, bpm: number): number {
  return stepsPerBar >= 5 ? 60 / bpm / 2 : 60 / bpm
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

function semitoneToFreq(semitone: number): number {
  if (semitone >= 4) {
    return OPEN_STRING_FREQS[5] * Math.pow(2, (semitone - 4) / 12)
  } else {
    return OPEN_STRING_FREQS[4] * Math.pow(2, (semitone + 1) / 12)
  }
}

function makeEmptyChords(n = INITIAL_BARS): ChordSlot[] {
  return Array.from({ length: n }, () => ({ root: null, suffix: null, positionIndex: 0 }))
}

function makeEmptyMelody(n = INITIAL_BARS): (MelodyNote | null)[][] {
  return Array.from({ length: n }, () => Array(MELODY_SLOTS).fill(null))
}

export function useSequencer() {
  const [state, setState] = useState<SequencerState>({
    bpm: 80,
    pattern: '53231323',
    keyRoot: 0,
    timeSig: '4/4',
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

  const chordsRef   = useRef(state.chords)
  const melodyRef   = useRef(state.melody)
  const patternRef  = useRef(state.pattern)
  const bpmRef      = useRef(state.bpm)
  const timeSigRef  = useRef(state.timeSig)

  useEffect(() => { chordsRef.current  = state.chords  }, [state.chords])
  useEffect(() => { melodyRef.current  = state.melody  }, [state.melody])

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
    const ctx      = audioEngine.getContext()
    const gen      = genRef.current
    const pat      = patternRef.current
    const bpm      = bpmRef.current
    const timeSig  = timeSigRef.current
    const steps    = getPatternSteps(pat)
    const spb      = getStepsPerBar(pat, timeSig)
    const sPerStep = getSPerStep(spb, bpm)
    const numBars  = chordsRef.current.length
    const total    = numBars * spb

    while (nextTimeRef.current < ctx.currentTime + 0.1) {
      const globalStep = stepRef.current % total
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
        // stepInBar % steps.length: handles spb < pattern.length gracefully
        scheduleStep(steps[stepInBar % steps.length], nextTimeRef.current, stepInBar === 0, posRef.current)
      }

      // Melody fires at every arpeggio step — stepInBar maps directly to melody slot
      const note = melodyRef.current[bar]?.[stepInBar]
      if (note) {
        pluckStringAt(semitoneToFreq(note.semitone), nextTimeRef.current + 0.005, 0.85)
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

  const setMelodyNote = useCallback((bar: number, slot: number, note: MelodyNote | null) => {
    setState(s => {
      const melody = s.melody.map((row, i) =>
        i === bar ? row.map((n, j) => j === slot ? note : n) : row
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

  const setTimeSig = useCallback((timeSig: TimeSig) => {
    timeSigRef.current = timeSig
    setState(s => ({ ...s, timeSig }))
  }, [])

  const addBar = useCallback(() => {
    setState(s => {
      if (s.chords.length >= MAX_BARS) return s
      const chords = [...s.chords, { root: null, suffix: null, positionIndex: 0 }]
      const melody = [...s.melody, Array(MELODY_SLOTS).fill(null)]
      chordsRef.current = chords
      melodyRef.current = melody
      return { ...s, chords, melody }
    })
  }, [])

  const removeLastBar = useCallback(() => {
    setState(s => {
      if (s.chords.length <= 1) return s
      const chords = s.chords.slice(0, -1)
      const melody = s.melody.slice(0, -1)
      chordsRef.current = chords
      melodyRef.current = melody
      return { ...s, chords, melody }
    })
  }, [])

  useEffect(() => () => stop(), [stop])

  return { state, setChordSlot, setMelodyNote, setBpm, setPattern, setKeyRoot, setTimeSig, addBar, removeLastBar, play, stop }
}
