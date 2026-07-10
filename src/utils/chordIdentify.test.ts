import { describe, it, expect } from 'vitest'
import { identifyChord } from './chordIdentify'

// frets 数组：低音E → 高音e，null=闷弦，0=空弦
describe('identifyChord', () => {
  it('识别 C 大调开放和弦 x32010', () => {
    const r = identifyChord([null, 3, 2, 0, 1, 0])
    expect(r.name).toBe('C')
    expect(r.root).toBe(0)
    expect(r.suffix).toBe('major')
    expect(r.isSlash).toBe(false)
  })

  it('识别省略五度的 C7 (x32310：C E Bb，无 G)', () => {
    const r = identifyChord([null, 3, 2, 3, 1, 0])
    expect(r.name).toBe('C7')
    expect(r.suffix).toBe('7')
  })

  it('识别 Am 开放和弦 x02210', () => {
    const r = identifyChord([null, 0, 2, 2, 1, 0])
    expect(r.name).toBe('Am')
    expect(r.suffix).toBe('minor')
  })

  it('纯三和弦不产生"脑补省略音"的别名', () => {
    const r = identifyChord([null, 0, 2, 2, 1, 0]) // Am
    expect(r.candidates.map(c => c.name)).not.toContain('C6/A')
  })

  it('识别转位和弦 C/E (032010)', () => {
    const r = identifyChord([0, 3, 2, 0, 1, 0])
    expect(r.name).toBe('C/E')
    expect(r.isSlash).toBe(true)
    expect(r.bass).toBe(4) // E
  })

  it('识别强力和弦 E5 (022xxx)', () => {
    const r = identifyChord([0, 2, 2, null, null, null])
    expect(r.name).toBe('E5')
  })

  it('识别 Eadd11 (002100)', () => {
    const r = identifyChord([0, 0, 2, 1, 0, 0])
    expect(r.name).toBe('Eadd11')
  })

  it('Am7 与 C6 互为别名 (x02010)', () => {
    const r = identifyChord([null, 0, 2, 0, 1, 0])
    expect(r.name).toBe('Am7')
    expect(r.candidates.map(c => c.name)).toContain('C6/A')
  })

  it('单音显示音名', () => {
    const r = identifyChord([null, 3, null, null, null, null]) // A弦3品 = C
    expect(r.isSingleNote).toBe(true)
    expect(r.name).toBe('C')
  })

  it('全闷弦返回空结果', () => {
    const r = identifyChord([null, null, null, null, null, null])
    expect(r.name).toBeNull()
    expect(r.soundingCount).toBe(0)
  })

  it('不构成和弦的音簇返回未知', () => {
    const r = identifyChord([0, 1, null, null, null, null]) // E + F 小二度
    expect(r.name).toBeNull()
    expect(r.notes.length).toBe(2)
  })
})
