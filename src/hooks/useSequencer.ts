import { useState, useRef, useCallback, useEffect } from 'react'
import { pluckStringAt, strumMutedAt, stopAllNodes } from '../audio/karplusStrong'
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
const STRUM_MUTE = -32

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

// 当前和弦槽占用的主网格槽数（strum 模式下按 noteValue 计算，其他模式固定为一小节）
export function getChordMasterDuration(chord: ChordSlot, timeSig: TimeSig): number {
  return Math.round(getMasterSlotsPerBar(timeSig) / (chord.noteValue ?? 1))
}

// 总和弦槽数（等于 melody 数组长度）
export function getTotalPhysicalBars(chords: ChordSlot[]): number {
  return chords.length
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

    if (step === STRUM_MUTE) {
      strumMutedAt(pos, time)
      return
    }

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
    const master     = getMasterSlotsPerBar(timeSig)
    const sPerMaster = getMasterSPerStep(bpm)
    const isStrum    = pat === 'strum'
    const chords     = chordsRef.current

    // Build chord event timeline (absolute master-slot positions)
    let cumSlots = 0
    const chordStarts: number[] = []
    const chordDurs: number[] = []
    for (const c of chords) {
      chordStarts.push(cumSlots)
      const dur = isStrum ? getChordMasterDuration(c, timeSig) : master
      chordDurs.push(dur)
      cumSlots += dur
    }
    const total = cumSlots || master

    const spb      = getStepsPerBar(pat, timeSig)
    const arpEvery = master / spb

    while (nextTimeRef.current < ctx.currentTime + 0.1) {
      const globalStep = stepRef.current % total

      // Find current chord slot index
      let chordIdx = 0
      for (let i = chords.length - 1; i >= 0; i--) {
        if (globalStep >= chordStarts[i]) { chordIdx = i; break }
      }
      const posInChord = globalStep - chordStarts[chordIdx]

      // Chord switch
      if (posInChord === 0) {
        const slot = chords[chordIdx]
        posRef.current = (slot.root && slot.suffix)
          ? (getChordEntry(slot.root, slot.suffix)?.positions[slot.positionIndex] ?? null)
          : null

        const ms = Math.max(0, (nextTimeRef.current - ctx.currentTime) * 1000)
        setTimeout(() => {
          if (genRef.current !== gen) return
          setState(s => ({ ...s, currentBar: chordIdx }))
        }, ms)
      }

      if (isStrum) {
        // Strum: one sweep per chord event, direction per slot (down/up/mute)
        if (posInChord === 0 && posRef.current) {
          const dir = chords[chordIdx].strumDir ?? 'D'
          const strumStep = dir === 'U' ? STRUM_UP : dir === 'X' ? STRUM_MUTE : STRUM_DOWN
          scheduleStep(strumStep, nextTimeRef.current, true, posRef.current)
        }
      } else {
        // Fingerpicking / arpeggio: regular steps within the bar
        if (posInChord % arpEvery === 0 && posRef.current) {
          const arpStep = Math.round(posInChord / arpEvery)
          scheduleStep(steps[arpStep % steps.length], nextTimeRef.current, arpStep === 0, posRef.current)
        }
      }

      // Melody: indexed by [chordIdx][posInChord]
      const note = melodyRef.current[chordIdx]?.[posInChord]
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

  // Simple setter: no melody resize needed (melody.length === chords.length always)
  const setChordSlot = useCallback((chordIdx: number, slot: ChordSlot) => {
    setState(s => {
      if (s.chords[chordIdx] === undefined) return s
      const chords = s.chords.map((c, i) => i === chordIdx ? slot : c)
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

  const addBar = useCallback((noteValue?: 1|2|4|8|16) => {
    setState(s => {
      const limit = s.pattern === 'strum' ? 128 : MAX_BARS
      if (s.chords.length >= limit) return s
      const slot: ChordSlot = { root: null, suffix: null, positionIndex: 0 }
      if (noteValue && noteValue > 1) slot.noteValue = noteValue
      const chords = [...s.chords, slot]
      const melody = [...s.melody, Array(MASTER_SLOTS).fill(null)]
      chordsRef.current = chords
      melodyRef.current = melody
      return { ...s, chords, melody }
    })
  }, [])

  // Append multiple strum chord events at once (used by preset rhythm patterns)
  const addStrumPattern = useCallback((slots: ChordSlot[]) => {
    setState(s => {
      if (s.pattern !== 'strum') return s
      const room = 128 - s.chords.length
      const toAdd = slots.slice(0, Math.max(0, room))
      if (toAdd.length === 0) return s
      const chords = [...s.chords, ...toAdd]
      const melody = [...s.melody, ...toAdd.map(() => Array(MASTER_SLOTS).fill(null))]
      chordsRef.current = chords
      melodyRef.current = melody
      return { ...s, chords, melody }
    })
  }, [])

  // Replace a single chord slot with a full bar of strum events (rhythm-fill from the picker)
  const fillBarAt = useCallback((chordIdx: number, slots: ChordSlot[]) => {
    setState(s => {
      if (chordIdx < 0 || chordIdx >= s.chords.length || slots.length === 0) return s
      // Respect the strum-mode slot cap (net change = slots.length - 1)
      if (s.chords.length - 1 + slots.length > 128) return s
      const chords = [...s.chords.slice(0, chordIdx), ...slots, ...s.chords.slice(chordIdx + 1)]
      const rows = slots.map(() => Array(MASTER_SLOTS).fill(null))
      const melody = [...s.melody.slice(0, chordIdx), ...rows, ...s.melody.slice(chordIdx + 1)]
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
    const chords = makeEmptyChords()
    const melody = makeEmptyMelody()
    chordsRef.current = chords
    melodyRef.current = melody
    setState(s => ({ ...s, chords, melody }))
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

  // Atomically load a full composition
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
    const n = newChords.length
    const newMelody = [...melody]
    while (newMelody.length < n) newMelody.push(Array(MASTER_SLOTS).fill(null))
    if (newMelody.length > n) newMelody.length = n
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
    setTimeSig, setNoteDuration, addBar, addStrumPattern, fillBarAt, removeLastBar, clearAll, resetBars, loadComposition, transpose, play, stop,
  }
}
