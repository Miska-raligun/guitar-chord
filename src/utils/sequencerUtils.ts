import { OPEN_STRING_FREQS } from '../types/chord'
import type { ChordPosition } from '../types/chord'
import type { ChordSlot, MelodyNote, SequencerState, TimeSig } from '../types/audio'

// ─── 常量 ─────────────────────────────────────────────────────
export const INITIAL_BARS    = 8
export const MAX_BARS        = 64
export const MAX_STRUM_SLOTS = 512  // strum 模式按"和弦事件"计数（一小节可细分为多个事件）
export const MASTER_SLOTS    = 16   // 十六分音符主网格，每小节始终存 16 个槽位

// ─── 节奏型步骤 ────────────────────────────────────────────────
export type PatternStep = number | number[]
export const BASS       = -10
export const MUTE_BASS  = -11
export const REST       = -20
export const STRUM_DOWN = -30
export const STRUM_UP   = -31
export const STRUM_MUTE = -32

const PATTERN_53231323: PatternStep[] = [BASS,      3, 4, 3, 5, 3, 4, 3]
const PATTERN_X3231323: PatternStep[] = [MUTE_BASS, 3, 4, 3, 5, 3, 4, 3]
const PATTERN_3_12_3:   PatternStep[] = [BASS, 3, [4, 5], 3]

export function getPatternSteps(pat: SequencerState['pattern']): PatternStep[] {
  if (pat === '53231323') return PATTERN_53231323
  if (pat === 'x3231323') return PATTERN_X3231323
  if (pat === '3_12_3')   return PATTERN_3_12_3
  return [STRUM_DOWN, STRUM_DOWN, STRUM_DOWN, STRUM_DOWN]
}

// ─── 网格换算 ─────────────────────────────────────────────────
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
export function getMasterSPerStep(bpm: number): number {
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

// ─── 发声换算 ─────────────────────────────────────────────────
export function getBassString(pos: ChordPosition): number {
  for (let i = 0; i < pos.frets.length; i++) {
    if (pos.frets[i] !== -1) return i
  }
  return 1
}

export function getFreq(pos: ChordPosition, strIdx: number): number | null {
  // 生成型和弦提供 6 位对齐的绝对 midi 时优先使用（见 data/addChords.ts）
  const m = pos.midi
  if (m && m.length === 6) {
    const note = m[strIdx]
    return note < 0 ? null : 440 * Math.pow(2, (note - 69) / 12)
  }
  const fret = pos.frets[strIdx]
  if (fret === -1) return null
  return OPEN_STRING_FREQS[strIdx] * Math.pow(2, fret / 12)
}

export function semitoneToFreq(semitone: number): number {
  if (semitone >= 4) {
    return OPEN_STRING_FREQS[5] * Math.pow(2, (semitone - 4) / 12)
  } else {
    return OPEN_STRING_FREQS[4] * Math.pow(2, (semitone + 1) / 12)
  }
}

// ─── 状态构造 ─────────────────────────────────────────────────
export function makeEmptyChords(n = INITIAL_BARS): ChordSlot[] {
  return Array.from({ length: n }, () => ({ root: null, suffix: null, positionIndex: 0 }))
}

export function makeEmptyMelody(n = INITIAL_BARS): (MelodyNote | null)[][] {
  return Array.from({ length: n }, () => Array(MASTER_SLOTS).fill(null))
}

// ─── 细分小节时保留旋律 ────────────────────────────────────────
// 把一小节内若干旧事件的旋律行（每行只用前 dur 个槽）拍平成整小节的连续槽位，
// 再按新的均匀细分重新切成 newSlotCount 行（每行 MASTER_SLOTS 长，只用前 newSlotDur 个槽）。
// 音符落在包含其起始槽位的新行里；时值跨行由显示层截断，播放不受影响。
export function resplitBarMelody(
  rows: (MelodyNote | null)[][],
  durs: number[],
  newSlotCount: number,
  newSlotDur: number,
): (MelodyNote | null)[][] {
  const flat: (MelodyNote | null)[] = []
  rows.forEach((row, i) => {
    const dur = durs[i] ?? 0
    for (let p = 0; p < dur; p++) flat.push(row?.[p] ?? null)
  })
  return Array.from({ length: newSlotCount }, (_, k) => {
    const row: (MelodyNote | null)[] = Array(MASTER_SLOTS).fill(null)
    for (let off = 0; off < newSlotDur && off < MASTER_SLOTS; off++) {
      row[off] = flat[k * newSlotDur + off] ?? null
    }
    return row
  })
}
