import { useState, useRef, useCallback, useEffect } from 'react'
import { pluckStringAt, stopAllNodes } from '../audio/karplusStrong'
import audioEngine from '../audio/AudioEngine'
import { OPEN_STRING_FREQS } from '../types/chord'
import type { ChordPosition } from '../types/chord'
import type { ChordSlot, MelodyNote, SequencerState, TimeSig } from '../types/audio'
import { useChordDb } from './useChordDb'

const INITIAL_BARS  = 8
const MAX_BARS      = 32
const MASTER_SLOTS  = 16  // 十六分音符主网格，每小节始终存 16 个槽位

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

// 节拍器步数（决定拨弦频率）
export function getStepsPerBar(pat: SequencerState['pattern'], timeSig: TimeSig): number {
  const is8step = pat === '53231323' || pat === 'x3231323'
  if (timeSig === '4/4') return is8step ? 8 : 4
  if (timeSig === '3/4' || timeSig === '6/8') return is8step ? 6 : 3
  return is8step ? 4 : 2  // 2/4
}

// 主网格槽数（十六分音符数）
export function getMasterSlotsPerBar(timeSig: TimeSig): number {
  if (timeSig === '4/4') return 16
  if (timeSig === '3/4' || timeSig === '6/8') return 12
  return 8  // 2/4
}

// 主步长始终是十六分音符时长
function getMasterSPerStep(bpm: number): number {
  return 60 / bpm / 4
}

// 当前时值下显示的格子数
export function getMelodyDisplaySlots(noteDuration: SequencerState['noteDuration'], timeSig: TimeSig): number {
  return Math.max(1, Math.floor(getMasterSlotsPerBar(timeSig) / noteDuration))
}

// 显示格子 c → 主网格起始槽位
export function cellToMasterSlot(cell: number, noteDuration: SequencerState['noteDuration']): number {
  return cell * noteDuration
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
  return Array.from({ length: n }, () => Array(MASTER_SLOTS).fill(null))
}

export function useSequencer() {
  const [state, setState] = useState<SequencerState>({
    bpm: 80,
    pattern: '53231323',
    keyRoot: 0,
    timeSig: '4/4',
    noteDuration: 2,
    chords: makeEmptyChords(),
    melody: makeEmptyMelody(),
    isPlaying: false,
    currentBar: -1,
  })

  const { getChordEntry } = useChordDb()

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextTimeRef = useRef(0)
  const stepRef     = useRef(0)
  const genRef      = useRef(0)
  const posRef      = useRef<ChordPosition | null>(null)

  const chordsRef    = useRef(state.chords)
  const melodyRef    = useRef(state.melody)
  const patternRef   = useRef(state.pattern)
  const bpmRef       = useRef(state.bpm)
  const timeSigRef   = useRef(state.timeSig)

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
    const ctx        = audioEngine.getContext()
    const gen        = genRef.current
    const pat        = patternRef.current
    const bpm        = bpmRef.current
    const timeSig    = timeSigRef.current
    const steps      = getPatternSteps(pat)
    const spb        = getStepsPerBar(pat, timeSig)     // 拨弦步数/节
    const master     = getMasterSlotsPerBar(timeSig)    // 十六分槽数/节
    const sPerMaster = getMasterSPerStep(bpm)           // 始终是十六分音符时长
    const arpEvery   = master / spb                     // 每隔几个主步触发一次拨弦
    const numBars    = chordsRef.current.length
    const total      = numBars * master

    while (nextTimeRef.current < ctx.currentTime + 0.1) {
      const globalStep  = stepRef.current % total
      const bar         = Math.floor(globalStep / master)
      const masterInBar = globalStep % master

      // 小节切换
      if (masterInBar === 0) {
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

      // 拨弦：每 arpEvery 个主步触发一次
      if (masterInBar % arpEvery === 0 && posRef.current) {
        const arpStep = Math.round(masterInBar / arpEvery)
        scheduleStep(steps[arpStep % steps.length], nextTimeRef.current, arpStep === 0, posRef.current)
      }

      // 旋律：直接读取对应主槽位的音符
      const note = melodyRef.current[bar]?.[masterInBar]
      if (note) {
        pluckStringAt(semitoneToFreq(note.semitone), nextTimeRef.current + 0.005, 0.85)
      }

      nextTimeRef.current += sPerMaster
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

  const setMelodyNote = useCallback((bar: number, masterSlot: number, note: MelodyNote | null) => {
    setState(s => {
      const melody = s.melody.map((row, i) => {
        if (i !== bar) return row
        const newRow = [...row]
        if (note === null) {
          newRow[masterSlot] = null
        } else {
          // Clear any existing note whose duration overlaps the new note's range
          for (let m = 0; m < MASTER_SLOTS; m++) {
            const existing = newRow[m]
            if (!existing) continue
            const overlaps = m < masterSlot + note.duration && m + existing.duration > masterSlot
            if (overlaps) newRow[m] = null
          }
          newRow[masterSlot] = note
        }
        return newRow
      })
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

  const setNoteDuration = useCallback((noteDuration: SequencerState['noteDuration']) => {
    setState(s => ({ ...s, noteDuration }))
  }, [])

  const addBar = useCallback(() => {
    setState(s => {
      if (s.chords.length >= MAX_BARS) return s
      const chords = [...s.chords, { root: null, suffix: null, positionIndex: 0 }]
      const melody = [...s.melody, Array(MASTER_SLOTS).fill(null)]
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

  const ROOTS = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'] as const
  const transpose = useCallback((semitones: number) => {
    setState(s => {
      const shift = ((semitones % 12) + 12) % 12
      const chords = s.chords.map(slot => {
        if (!slot.root) return slot
        const idx = ROOTS.indexOf(slot.root as typeof ROOTS[number])
        return { ...slot, root: ROOTS[(idx + shift) % 12] }
      })
      const melody = s.melody.map(bar =>
        bar.map(note => note ? { ...note, semitone: (note.semitone + shift) % 12 } : null)
      )
      const keyRoot = (s.keyRoot + shift) % 12
      chordsRef.current = chords
      melodyRef.current = melody
      return { ...s, chords, melody, keyRoot }
    })
  }, [])

  const clearAll = useCallback(() => {
    stop()
    setState(s => {
      const chords = s.chords.map(() => ({ root: null, suffix: null, positionIndex: 0 }))
      const melody = s.melody.map(() => Array(MASTER_SLOTS).fill(null))
      chordsRef.current = chords as ChordSlot[]
      melodyRef.current = melody
      return { ...s, chords: chords as ChordSlot[], melody }
    })
  }, [stop])

  const resetBars = useCallback((numBars: number) => {
    stop()
    const n = Math.max(1, Math.min(MAX_BARS, numBars))
    const chords = makeEmptyChords(n)
    const melody = makeEmptyMelody(n)
    chordsRef.current = chords
    melodyRef.current = melody
    setState(s => ({ ...s, chords, melody }))
  }, [stop])

  // Atomically load a full composition in one setState — avoids timing issues
  // with batching multiple setChordSlot calls
  const loadComposition = useCallback((
    chords: ChordSlot[],
    melody: (MelodyNote | null)[][],
    opts: {
      bpm?: number
      pattern?: SequencerState['pattern']
      keyRoot?: number
      timeSig?: TimeSig
      noteDuration?: SequencerState['noteDuration']
    } = {}
  ) => {
    stop()
    const newChords = [...chords]
    const newMelody = [...melody]
    chordsRef.current = newChords
    melodyRef.current = newMelody
    if (opts.bpm      !== undefined) bpmRef.current     = opts.bpm
    if (opts.pattern  !== undefined) patternRef.current = opts.pattern
    if (opts.timeSig  !== undefined) timeSigRef.current = opts.timeSig
    setState(s => ({
      ...s,
      chords: newChords,
      melody: newMelody,
      ...(opts.bpm         !== undefined ? { bpm:          opts.bpm         } : {}),
      ...(opts.pattern     !== undefined ? { pattern:      opts.pattern     } : {}),
      ...(opts.keyRoot     !== undefined ? { keyRoot:      opts.keyRoot     } : {}),
      ...(opts.timeSig     !== undefined ? { timeSig:      opts.timeSig     } : {}),
      ...(opts.noteDuration !== undefined ? { noteDuration: opts.noteDuration } : {}),
    }))
  }, [stop])

  useEffect(() => () => stop(), [stop])

  return {
    state,
    setChordSlot, setMelodyNote, setBpm, setPattern, setKeyRoot,
    setTimeSig, setNoteDuration, addBar, removeLastBar, clearAll, resetBars, loadComposition, transpose, play, stop,
  }
}
