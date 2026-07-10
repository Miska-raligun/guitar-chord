import { useState, useRef, useCallback, useEffect } from 'react'
import { pluckStringAt, strumMutedAt, stopAllNodes } from '../audio/karplusStrong'
import audioEngine from '../audio/AudioEngine'
import type { ChordPosition } from '../types/chord'
import type { ChordSlot, MelodyNote, SequencerState, TimeSig } from '../types/audio'
import { useChordDb } from './useChordDb'
import {
  INITIAL_BARS, MAX_BARS, MAX_STRUM_SLOTS, MASTER_SLOTS,
  BASS, MUTE_BASS, REST, STRUM_DOWN, STRUM_UP, STRUM_MUTE,
  getPatternSteps, getStepsPerBar, getMasterSlotsPerBar, getChordMasterDuration,
  getMasterSPerStep, getFreq, getBassString, semitoneToFreq,
  makeEmptyChords, makeEmptyMelody, resplitBarMelody,
} from '../utils/sequencerUtils'
import type { PatternStep } from '../utils/sequencerUtils'

// 兼容旧导入路径：网格换算函数历史上从本文件导出
export {
  getStepsPerBar, getMasterSlotsPerBar, getChordMasterDuration,
  getTotalPhysicalBars, getMelodyDisplaySlots, cellToMasterSlot,
} from '../utils/sequencerUtils'

const BASS_VOL   = 0.88
const TREBLE_VOL = 0.55
const SWEEP_DUR  = 0.055

const MAX_HISTORY = 50

interface Snapshot {
  chords: ChordSlot[]
  melody: (MelodyNote | null)[][]
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

  // ── 撤销/重做 ──────────────────────────────────────────────
  // 每次内容变更前把 {chords, melody} 快照压入 past 栈（引用相等去重，
  // 因此 StrictMode 下 updater 双调用也不会重复入栈）。
  const pastRef   = useRef<Snapshot[]>([])
  const futureRef = useRef<Snapshot[]>([])

  function pushHistory(s: Pick<SequencerState, 'chords' | 'melody'>) {
    const top = pastRef.current[pastRef.current.length - 1]
    if (top && top.chords === s.chords && top.melody === s.melody) return
    pastRef.current.push({ chords: s.chords, melody: s.melody })
    if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift()
    futureRef.current = []
  }

  const undo = useCallback(() => {
    const prev = pastRef.current.pop()
    if (!prev) return
    futureRef.current.push({ chords: chordsRef.current, melody: melodyRef.current })
    chordsRef.current = prev.chords
    melodyRef.current = prev.melody
    setState(s => ({ ...s, chords: prev.chords, melody: prev.melody }))
  }, [])

  const redo = useCallback(() => {
    const next = futureRef.current.pop()
    if (!next) return
    pastRef.current.push({ chords: chordsRef.current, melody: melodyRef.current })
    chordsRef.current = next.chords
    melodyRef.current = next.melody
    setState(s => ({ ...s, chords: next.chords, melody: next.melody }))
  }, [])

  // ── 播放调度 ───────────────────────────────────────────────
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
    for (const c of chords) {
      chordStarts.push(cumSlots)
      cumSlots += isStrum ? getChordMasterDuration(c, timeSig) : master
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

  // ── 内容编辑 ───────────────────────────────────────────────
  // Simple setter: no melody resize needed (melody.length === chords.length always)
  const setChordSlot = useCallback((chordIdx: number, slot: ChordSlot) => {
    setState(s => {
      if (s.chords[chordIdx] === undefined) return s
      pushHistory(s)
      const chords = s.chords.map((c, i) => i === chordIdx ? slot : c)
      chordsRef.current = chords
      return { ...s, chords }
    })
  }, [])

  const setMelodyNote = useCallback((bar: number, masterSlot: number, note: MelodyNote | null) => {
    setState(s => {
      pushHistory(s)
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
      const limit = s.pattern === 'strum' ? MAX_STRUM_SLOTS : MAX_BARS
      if (s.chords.length >= limit) return s
      pushHistory(s)
      const slot: ChordSlot = { root: null, suffix: null, positionIndex: 0 }
      if (noteValue && noteValue > 1) slot.noteValue = noteValue
      const chords = [...s.chords, slot]
      const melody = [...s.melody, Array(MASTER_SLOTS).fill(null)]
      chordsRef.current = chords
      melodyRef.current = melody
      return { ...s, chords, melody }
    })
  }, [])

  // 追加一个带和弦的整小节事件（供识别页"加入编曲"等外部入口使用）
  const appendChordSlot = useCallback((root: string, suffix: string) => {
    setState(s => {
      const limit = s.pattern === 'strum' ? MAX_STRUM_SLOTS : MAX_BARS
      if (s.chords.length >= limit) return s
      pushHistory(s)
      const chords = [...s.chords, { root, suffix, positionIndex: 0 }]
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
      const room = MAX_STRUM_SLOTS - s.chords.length
      const toAdd = slots.slice(0, Math.max(0, room))
      if (toAdd.length === 0) return s
      pushHistory(s)
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
      if (s.chords.length - 1 + slots.length > MAX_STRUM_SLOTS) return s
      pushHistory(s)
      const chords = [...s.chords.slice(0, chordIdx), ...slots, ...s.chords.slice(chordIdx + 1)]
      const rows = slots.map(() => Array(MASTER_SLOTS).fill(null))
      const melody = [...s.melody.slice(0, chordIdx), ...rows, ...s.melody.slice(chordIdx + 1)]
      chordsRef.current = chords
      melodyRef.current = melody
      return { ...s, chords, melody }
    })
  }, [])

  // Split (or merge) the bar starting at firstChordIdx into `noteValue` uniform
  // strum slots (each noteValue=N, N of them exactly fill one bar). The bar's
  // primary chord + strum direction carry into every new slot; melody notes are
  // preserved by their absolute position within the bar (see resplitBarMelody).
  const setBarSubdivision = useCallback((firstChordIdx: number, noteValue: 1|2|4|8|16) => {
    setState(s => {
      if (s.pattern !== 'strum') return s
      if (firstChordIdx < 0 || firstChordIdx >= s.chords.length) return s
      const masterPerBar = getMasterSlotsPerBar(s.timeSig)
      // Find the slot range [firstChordIdx, end) that makes up this bar.
      let acc = 0
      let end = firstChordIdx
      while (end < s.chords.length && acc < masterPerBar) {
        acc += getChordMasterDuration(s.chords[end], s.timeSig)
        end++
      }
      const barSlots = s.chords.slice(firstChordIdx, end)
      const primary = barSlots.find(c => c.root && c.suffix) ?? barSlots[0]
      const dir = primary.strumDir
      const count = noteValue  // N slots of noteValue=N fill exactly one bar
      const newSlots: ChordSlot[] = Array.from({ length: count }, () => ({
        root: primary.root,
        suffix: primary.suffix,
        positionIndex: 0,
        ...(noteValue > 1 ? { noteValue } : {}),
        ...(dir && dir !== 'D' ? { strumDir: dir } : {}),
      }))
      const chords = [...s.chords.slice(0, firstChordIdx), ...newSlots, ...s.chords.slice(end)]
      if (chords.length > MAX_STRUM_SLOTS) return s
      pushHistory(s)
      const oldRows = s.melody.slice(firstChordIdx, end)
      const oldDurs = barSlots.map(c => getChordMasterDuration(c, s.timeSig))
      const rows = resplitBarMelody(oldRows, oldDurs, count, Math.round(masterPerBar / count))
      const melody = [...s.melody.slice(0, firstChordIdx), ...rows, ...s.melody.slice(end)]
      chordsRef.current = chords
      melodyRef.current = melody
      return { ...s, chords, melody }
    })
  }, [])

  const removeLastBar = useCallback(() => {
    setState(s => {
      if (s.chords.length <= 1) return s
      pushHistory(s)
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
      pushHistory(s)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clearAll = useCallback(() => {
    stop()
    pushHistory({ chords: chordsRef.current, melody: melodyRef.current })
    const chords = makeEmptyChords()
    const melody = makeEmptyMelody()
    chordsRef.current = chords
    melodyRef.current = melody
    setState(s => ({ ...s, chords, melody }))
  }, [stop])

  const resetBars = useCallback((numBars: number) => {
    stop()
    pushHistory({ chords: chordsRef.current, melody: melodyRef.current })
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
    pushHistory({ chords: chordsRef.current, melody: melodyRef.current })
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
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    undo, redo,
    setChordSlot, setMelodyNote, setBpm, setPattern, setKeyRoot,
    setTimeSig, setNoteDuration, addBar, appendChordSlot, addStrumPattern, fillBarAt, setBarSubdivision,
    removeLastBar, clearAll, resetBars, loadComposition, transpose, play, stop,
  }
}
