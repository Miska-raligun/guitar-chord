import { describe, it, expect } from 'vitest'
import { diatonicChords, nextDegreeSuggestions, findDegreeByRoot } from './musicTheory'

describe('diatonicChords', () => {
  it('C 大调调内和弦：C Dm Em F G Am B°', () => {
    const d = diatonicChords(0)
    expect(d.map(c => c.root)).toEqual([0, 2, 4, 5, 7, 9, 11])
    expect(d.map(c => c.suffix)).toEqual(['major','minor','minor','major','major','minor','dim'])
    expect(d.map(c => c.numeral)).toEqual(['I','ii','iii','IV','V','vi','vii°'])
  })

  it('G 大调根音正确（G A B C D E F#）', () => {
    expect(diatonicChords(7).map(c => c.root)).toEqual([7, 9, 11, 0, 2, 4, 6])
  })

  it('任意调都是 7 个和弦、性质模式一致', () => {
    for (let k = 0; k < 12; k++) {
      const d = diatonicChords(k)
      expect(d).toHaveLength(7)
      expect(d[0].suffix).toBe('major')
      expect(d[5].suffix).toBe('minor')
      expect(d[6].suffix).toBe('dim')
    }
  })
})

describe('进行建议', () => {
  it('I 级建议接 IV/V/vi', () => {
    const next = nextDegreeSuggestions(0)
    expect(next).toContain(3)  // IV
    expect(next).toContain(4)  // V
    expect(next).toContain(5)  // vi
  })

  it('V 级最常接回 I', () => {
    expect(nextDegreeSuggestions(4)[0]).toBe(0)
  })

  it('越界级数返回空数组', () => {
    expect(nextDegreeSuggestions(99)).toEqual([])
  })
})

describe('findDegreeByRoot', () => {
  it('C 调里 G 是 V 级', () => {
    expect(findDegreeByRoot(0, 7)?.numeral).toBe('V')
  })

  it('C 调里 A 是 vi 级', () => {
    expect(findDegreeByRoot(0, 9)?.numeral).toBe('vi')
  })

  it('调外音返回 null', () => {
    expect(findDegreeByRoot(0, 1)).toBeNull()  // C# 不在 C 大调内
  })
})
