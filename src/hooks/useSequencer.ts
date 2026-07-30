import { useState, useRef, useCallback, useEffect } from 'react'
import { pluckStringAt, strumMutedAt, stopAllNodes } from '../audio/karplusStrong'
import audioEngine from '../audio/AudioEngine'
import type { ChordPosition } from '../types/chord'
import type { ChordSlot, MelodyNote, SequencerState, TimeSig } from '../types/audio'
import { useChordDb } from './useChordDb'
import { scheduleClick } from './useMetronome'
import {
  MAX_BARS, MAX_STRUM_SLOTS, MASTER_SLOTS,
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

// 变速练习：从目标 BPM 的 70% 起步，每循环一遍提高 5%，直到目标速度
const RAMP_START_RATIO = 0.7
const RAMP_STEP_RATIO  = 0.05

// 撤销快照：内容 + 设置项
interface Snapshot {
  chords: ChordSlot[]
  melody: (MelodyNote | null)[][]
  bpm: number
  pattern: SequencerState['pattern']
  keyRoot: number
  timeSig: TimeSig
  noteDuration: SequencerState['noteDuration']
  capo: number
}

export interface LoopRange { start: number; end: number }  // 1-based 物理小节，含端点

function snapOf(s: Pick<SequencerState, keyof Snapshot>): Snapshot {
  const { chords, melody, bpm, pattern, keyRoot, timeSig, noteDuration, capo } = s
  return { chords, melody, bpm, pattern, keyRoot, timeSig, noteDuration, capo }
}

function snapEquals(a: Snapshot, b: Snapshot): boolean {
  return a.chords === b.chords && a.melody === b.melody
    && a.bpm === b.bpm && a.pattern === b.pattern && a.keyRoot === b.keyRoot
    && a.timeSig === b.timeSig && a.noteDuration === b.noteDuration && a.capo === b.capo
}

export function useSequencer() {
  const [state, setState] = useState<SequencerState>({
    bpm: 80,
    pattern: '53231323',
    keyRoot: 0,
    timeSig: '4/4',
    noteDuration: 2,
    capo: 0,
    chords: makeEmptyChords(),
    melody: makeEmptyMelody(),
    isPlaying: false,
    currentBar: -1,
  })

  // 练习辅助设置（不进快照/草稿：属于"当下怎么练"而非"曲子本身"）
  const [countIn,   setCountIn]   = useState(true)               // 预备拍
  const [loopRange, setLoopRangeState] = useState<LoopRange | null>(null)  // A-B 区间循环
  const [rampOn,    setRampOnState]    = useState(false)         // 变速练习

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
  const capoRef      = useRef(state.capo)
  const stateRef     = useRef(state)

  useEffect(() => { chordsRef.current = state.chords }, [state.chords])
  useEffect(() => { melodyRef.current = state.melody }, [state.melody])
  useEffect(() => { stateRef.current = state })

  const countInRef   = useRef(countIn)
  const loopRangeRef = useRef(loopRange)
  const rampRef      = useRef(rampOn)
  const rampTargetRef = useRef(0)         // 变速练习的目标 BPM（0 = 未激活）
  const prevStepRef   = useRef(-1)        // 用于检测循环回到起点
  useEffect(() => { countInRef.current = countIn }, [countIn])
  useEffect(() => { loopRangeRef.current = loopRange }, [loopRange])
  useEffect(() => { rampRef.current = rampOn }, [rampOn])

  const setLoopRange = useCallback((r: LoopRange | null) => setLoopRangeState(r), [])
  const setRampOn    = useCallback((on: boolean) => setRampOnState(on), [])

  // ── 撤销/重做 ──────────────────────────────────────────────
  // 每次内容或设置变更前把完整快照压入 past 栈（与栈顶完全相同则去重，
  // 因此 StrictMode 下 updater 双调用也不会重复入栈）。
  const pastRef   = useRef<Snapshot[]>([])
  const futureRef = useRef<Snapshot[]>([])

  function pushHistory(s: Pick<SequencerState, keyof Snapshot>) {
    const snap = snapOf(s)
    const top = pastRef.current[pastRef.current.length - 1]
    if (top && snapEquals(top, snap)) return
    pastRef.current.push(snap)
    if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift()
    futureRef.current = []
  }

  // 恢复快照：同步全部播放用 ref，再写回 state
  const applySnapshot = useCallback((snap: Snapshot) => {
    chordsRef.current  = snap.chords
    melodyRef.current  = snap.melody
    bpmRef.current     = snap.bpm
    patternRef.current = snap.pattern
    timeSigRef.current = snap.timeSig
    capoRef.current    = snap.capo
    setState(s => ({ ...s, ...snap }))
  }, [])

  const undo = useCallback(() => {
    const prev = pastRef.current.pop()
    if (!prev) return
    futureRef.current.push(snapOf(stateRef.current))
    applySnapshot(prev)
  }, [applySnapshot])

  const redo = useCallback(() => {
    const next = futureRef.current.pop()
    if (!next) return
    pastRef.current.push(snapOf(stateRef.current))
    applySnapshot(next)
  }, [applySnapshot])

  // ── 播放调度 ───────────────────────────────────────────────
  const scheduleStep = useCallback((step: PatternStep, time: number, isBass: boolean, pos: ChordPosition) => {
    if (step === REST) return
    const capoScale = Math.pow(2, capoRef.current / 12)  // 变调夹整体升高

    if (step === STRUM_MUTE) {
      strumMutedAt(pos, time, capoScale)
      return
    }

    if (step === STRUM_DOWN || step === STRUM_UP) {
      const strings = step === STRUM_DOWN ? [0,1,2,3,4,5] : [5,4,3,2,1,0]
      const dps = SWEEP_DUR / 5
      strings.forEach((si, i) => {
        const freq = getFreq(pos, si)
        if (freq === null) return
        pluckStringAt(freq * capoScale, time + i * dps, 0.78)
      })
      return
    }

    if (step === BASS || step === MUTE_BASS) {
      const si   = getBassString(pos)
      const freq = getFreq(pos, si)
      if (freq === null) return
      pluckStringAt(freq * capoScale, time, BASS_VOL)
      return
    }

    if (Array.isArray(step)) {
      step.forEach(si => {
        const freq = getFreq(pos, si)
        if (freq !== null) pluckStringAt(freq * capoScale, time, TREBLE_VOL * 1.1)
      })
      return
    }

    const freq = getFreq(pos, step)
    if (freq !== null) pluckStringAt(freq * capoScale, time, isBass ? BASS_VOL : TREBLE_VOL)
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

    // A-B 区间循环：把播放窗口限制在 [loopStart, loopEnd) 主槽范围内
    // （物理小节边界总在 master 的整数倍上）
    const lr = loopRangeRef.current
    let winStart = 0
    let winEnd = total
    if (lr) {
      const numBars = Math.ceil(total / master)
      const s = Math.max(1, Math.min(lr.start, numBars))
      const e = Math.max(s, Math.min(lr.end, numBars))
      winStart = (s - 1) * master
      winEnd   = Math.min(e * master, total)
    }
    const winLen = Math.max(1, winEnd - winStart)

    const spb      = getStepsPerBar(pat, timeSig)
    const arpEvery = master / spb

    while (nextTimeRef.current < ctx.currentTime + 0.1) {
      const globalStep = winStart + (stepRef.current % winLen)

      // 变速练习：每回到循环起点提速一档，直到目标 BPM
      if (globalStep === winStart && prevStepRef.current !== -1 && prevStepRef.current !== winStart
          && rampTargetRef.current > 0) {
        const target = rampTargetRef.current
        const next = Math.min(target, Math.round(bpmRef.current + target * RAMP_STEP_RATIO))
        if (next !== bpmRef.current) {
          bpmRef.current = next
          const gen2 = genRef.current
          setTimeout(() => { if (genRef.current === gen2) setState(s => ({ ...s, bpm: next })) }, 0)
        }
      }
      prevStepRef.current = globalStep

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
        const capoScale = Math.pow(2, capoRef.current / 12)
        pluckStringAt(semitoneToFreq(note.semitone) * capoScale, nextTimeRef.current + 0.005, 0.85)
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
    // 变速练习结束：恢复到目标 BPM
    const target = rampTargetRef.current
    rampTargetRef.current = 0
    if (target > 0) bpmRef.current = target
    setState(s => ({
      ...s, isPlaying: false, currentBar: -1,
      ...(target > 0 ? { bpm: target } : {}),
    }))
  }, [])

  const play = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    genRef.current++
    stopAllNodes()

    stepRef.current     = 0
    prevStepRef.current = -1
    posRef.current      = null

    audioEngine.resume()
    const ctx = audioEngine.getContext()
    let startAt = ctx.currentTime + 0.05

    // 变速练习：从目标 BPM 的 70% 起步
    if (rampRef.current) {
      rampTargetRef.current = bpmRef.current
      const startBpm = Math.max(30, Math.round(bpmRef.current * RAMP_START_RATIO))
      bpmRef.current = startBpm
      setState(s => ({ ...s, bpm: startBpm }))
    } else {
      rampTargetRef.current = 0
    }

    // 预备拍：先给一小节节拍器声，再进入正式播放
    if (countInRef.current) {
      const BEATS: Record<TimeSig, number> = { '4/4': 4, '3/4': 3, '6/8': 6, '2/4': 2 }
      const beats = BEATS[timeSigRef.current]
      const beatDur = getMasterSlotsPerBar(timeSigRef.current) * getMasterSPerStep(bpmRef.current) / beats
      for (let i = 0; i < beats; i++) {
        scheduleClick(ctx, startAt + i * beatDur, i === 0)
      }
      startAt += beats * beatDur
    }

    nextTimeRef.current = startAt
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
    setState(s => { pushHistory(s); return { ...s, bpm } })
  }, [])

  const setPattern = useCallback((pattern: SequencerState['pattern']) => {
    patternRef.current = pattern
    setState(s => { pushHistory(s); return { ...s, pattern } })
  }, [])

  const setKeyRoot = useCallback((keyRoot: number) => {
    setState(s => { pushHistory(s); return { ...s, keyRoot } })
  }, [])

  const setTimeSig = useCallback((timeSig: TimeSig) => {
    timeSigRef.current = timeSig
    setState(s => { pushHistory(s); return { ...s, timeSig } })
  }, [])

  const setNoteDuration = useCallback((noteDuration: SequencerState['noteDuration']) => {
    setState(s => { pushHistory(s); return { ...s, noteDuration } })
  }, [])

  const setCapo = useCallback((capo: number) => {
    const c = Math.max(0, Math.min(7, Math.round(capo)))
    capoRef.current = c
    setState(s => { pushHistory(s); return { ...s, capo: c } })
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
    pushHistory(stateRef.current)
    const chords = makeEmptyChords()
    const melody = makeEmptyMelody()
    chordsRef.current = chords
    melodyRef.current = melody
    setState(s => ({ ...s, chords, melody }))
  }, [stop])

  const resetBars = useCallback((numBars: number) => {
    stop()
    pushHistory(stateRef.current)
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
      capo?: number
    } = {}
  ) => {
    stop()
    pushHistory(stateRef.current)
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
    if (opts.capo     !== undefined) capoRef.current    = opts.capo
    setState(s => ({
      ...s,
      chords: newChords,
      melody: newMelody,
      ...(opts.bpm         !== undefined ? { bpm:          opts.bpm         } : {}),
      ...(opts.pattern     !== undefined ? { pattern:      opts.pattern     } : {}),
      ...(opts.keyRoot     !== undefined ? { keyRoot:      opts.keyRoot     } : {}),
      ...(opts.timeSig     !== undefined ? { timeSig:      opts.timeSig     } : {}),
      ...(opts.noteDuration !== undefined ? { noteDuration: opts.noteDuration } : {}),
      ...(opts.capo        !== undefined ? { capo:         opts.capo        } : {}),
    }))
  }, [stop])

  useEffect(() => () => stop(), [stop])

  return {
    state,
    // 历史栈只在 setState 的同一批次里变化（push 在 updater 内、undo/redo 自身 setState），
    // 因此每次渲染读到的长度总是新鲜的——这里读 ref 是安全的。
    // eslint-disable-next-line react-hooks/refs
    canUndo: pastRef.current.length > 0,
    // eslint-disable-next-line react-hooks/refs
    canRedo: futureRef.current.length > 0,
    undo, redo,
    setChordSlot, setMelodyNote, setBpm, setPattern, setKeyRoot,
    setTimeSig, setNoteDuration, setCapo, addBar, appendChordSlot, addStrumPattern, fillBarAt, setBarSubdivision,
    removeLastBar, clearAll, resetBars, loadComposition, transpose, play, stop,
    // 练习辅助
    countIn, setCountIn, loopRange, setLoopRange, rampOn, setRampOn,
  }
}
