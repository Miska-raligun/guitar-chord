import { describe, it, expect } from 'vitest'
import { parseComposition } from './useAiCompose'

describe('parseComposition', () => {
  it('解析指法模式：和弦 + 顺序旋律', () => {
    const raw = JSON.stringify({
      bpm: 90, timeSig: '4/4', pattern: '53231323', keyRoot: 0,
      chords: [
        { root: 'C', suffix: 'major' },
        { root: 'G', suffix: 'major' },
      ],
      melody: [
        [{ semitone: 0, dur: 4 }, { semitone: 4, dur: 4 }, null, null],  // null = 休止
        [],
      ],
    })
    const r = parseComposition(raw)
    expect(r.bpm).toBe(90)
    expect(r.chords).toHaveLength(2)
    expect(r.chords[0]).toMatchObject({ root: 'C', suffix: 'major' })
    // dur:4（四分音符）在 4/4 下占 4 个主槽
    expect(r.melody[0][0]).toMatchObject({ semitone: 0, duration: 4 })
    expect(r.melody[0][4]).toMatchObject({ semitone: 4, duration: 4 })
    expect(r.melody[0][8]).toBeNull()
  })

  it('剥离 markdown 代码栅栏', () => {
    const raw = '```json\n' + JSON.stringify({ bpm: 100, chords: [{ root: 'D', suffix: 'minor' }] }) + '\n```'
    const r = parseComposition(raw)
    expect(r.bpm).toBe(100)
    expect(r.chords[0].root).toBe('D')
  })

  it('扫弦模式保留 noteValue 与 strumDir', () => {
    const raw = JSON.stringify({
      bpm: 110, timeSig: '4/4', pattern: 'strum', keyRoot: 7,
      chords: [
        { root: 'G', suffix: 'major', noteValue: 8 },
        { root: 'G', suffix: 'major', noteValue: 8, strumDir: 'U' },
      ],
    })
    const r = parseComposition(raw)
    expect(r.pattern).toBe('strum')
    expect(r.chords[0].noteValue).toBe(8)
    expect(r.chords[1].strumDir).toBe('U')
  })

  it('指法模式强制 targetBars（截断/补齐）', () => {
    const raw = JSON.stringify({
      bpm: 80, pattern: '53231323',
      chords: [{ root: 'C', suffix: 'major' }, { root: 'G', suffix: 'major' }, { root: 'F', suffix: 'major' }],
    })
    expect(parseComposition(raw, 2).chords).toHaveLength(2)
    const padded = parseComposition(raw, 6)
    expect(padded.chords).toHaveLength(6)
    expect(padded.chords[5].root).toBeNull()
    expect(padded.melody).toHaveLength(6)
  })

  it('钳制非法 bpm 与非法拍号', () => {
    const r = parseComposition(JSON.stringify({ bpm: 999, timeSig: '7/8', chords: [] }))
    expect(r.bpm).toBeLessThanOrEqual(200)
    expect(r.timeSig).toBe('4/4')
  })
})
