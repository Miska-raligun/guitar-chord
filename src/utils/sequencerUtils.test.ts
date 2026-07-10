import { describe, it, expect } from 'vitest'
import {
  getMasterSlotsPerBar, getChordMasterDuration, getMelodyDisplaySlots,
  cellToMasterSlot, getStepsPerBar, resplitBarMelody, getFreq,
} from './sequencerUtils'
import type { MelodyNote } from '../types/audio'

describe('网格换算', () => {
  it('各拍号的主网格槽数', () => {
    expect(getMasterSlotsPerBar('4/4')).toBe(16)
    expect(getMasterSlotsPerBar('3/4')).toBe(12)
    expect(getMasterSlotsPerBar('6/8')).toBe(12)
    expect(getMasterSlotsPerBar('2/4')).toBe(8)
  })

  it('和弦事件时长按 noteValue 折算', () => {
    expect(getChordMasterDuration({ root: 'C', suffix: 'major', positionIndex: 0 }, '4/4')).toBe(16)
    expect(getChordMasterDuration({ root: 'C', suffix: 'major', positionIndex: 0, noteValue: 4 }, '4/4')).toBe(4)
    expect(getChordMasterDuration({ root: 'C', suffix: 'major', positionIndex: 0, noteValue: 8 }, '4/4')).toBe(2)
    expect(getChordMasterDuration({ root: 'C', suffix: 'major', positionIndex: 0, noteValue: 4 }, '3/4')).toBe(3)
  })

  it('旋律显示格数与槽位映射', () => {
    expect(getMelodyDisplaySlots(2, '4/4')).toBe(8)
    expect(getMelodyDisplaySlots(16, '4/4')).toBe(1)
    expect(cellToMasterSlot(3, 2)).toBe(6)
  })

  it('节奏型步数', () => {
    expect(getStepsPerBar('53231323', '4/4')).toBe(8)
    expect(getStepsPerBar('strum', '4/4')).toBe(4)
    expect(getStepsPerBar('53231323', '3/4')).toBe(6)
  })
})

describe('getFreq', () => {
  it('优先使用 6 位对齐 midi 数组（生成型和弦）', () => {
    const pos = { frets: [1, 1, 3, 2, 1, 1], fingers: [], baseFret: 8, barres: [], midi: [48, 53, 60, 64, 67, 72] }
    // midi 48 = C3 ≈ 130.81 Hz
    expect(getFreq(pos, 0)!).toBeCloseTo(130.81, 1)
    const muted = { ...pos, midi: [-1, 53, 60, 64, 67, 72] }
    expect(getFreq(muted, 0)).toBeNull()
  })

  it('无 midi 时按绝对品位折算', () => {
    const pos = { frets: [0, -1, -1, -1, -1, -1], fingers: [], baseFret: 1, barres: [] }
    expect(getFreq(pos, 0)!).toBeCloseTo(82.41, 1)  // 空弦 E2
    expect(getFreq(pos, 1)).toBeNull()
  })
})

describe('resplitBarMelody（细分小节保留旋律）', () => {
  const note = (semitone: number): MelodyNote => ({ semitone, duration: 2 })

  it('整小节 → 4 个四分：音符按绝对位置落入对应新行', () => {
    const row = Array(16).fill(null)
    row[0] = note(0)   // 第 1 拍
    row[6] = note(4)   // 第 2 拍后半
    row[12] = note(7)  // 第 4 拍
    const out = resplitBarMelody([row], [16], 4, 4)
    expect(out).toHaveLength(4)
    expect(out[0][0]).toMatchObject({ semitone: 0 })
    expect(out[1][2]).toMatchObject({ semitone: 4 })  // 槽位6 = 第2行(4-7)偏移2
    expect(out[3][0]).toMatchObject({ semitone: 7 })  // 槽位12 = 第4行偏移0
    // 其余为空
    expect(out[2].every(n => n === null)).toBe(true)
  })

  it('4 个四分 → 整小节：各行音符拼回连续槽位', () => {
    const rows = Array.from({ length: 4 }, () => Array(16).fill(null))
    rows[0][0] = note(0)
    rows[1][2] = note(4)
    rows[3][0] = note(7)
    const out = resplitBarMelody(rows, [4, 4, 4, 4], 1, 16)
    expect(out).toHaveLength(1)
    expect(out[0][0]).toMatchObject({ semitone: 0 })
    expect(out[0][6]).toMatchObject({ semitone: 4 })
    expect(out[0][12]).toMatchObject({ semitone: 7 })
  })

  it('细分数变化后仍保持行数与行长', () => {
    const out = resplitBarMelody([Array(16).fill(null)], [16], 8, 2)
    expect(out).toHaveLength(8)
    out.forEach(row => expect(row).toHaveLength(16))
  })
})
