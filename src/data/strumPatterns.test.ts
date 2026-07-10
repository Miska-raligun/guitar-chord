import { describe, it, expect } from 'vitest'
import { eighthsPerBar, buildPatternSlots, STRUM_PRESETS } from './strumPatterns'

describe('strumPatterns', () => {
  it('各拍号的八分音符数', () => {
    expect(eighthsPerBar('4/4')).toBe(8)
    expect(eighthsPerBar('3/4')).toBe(6)
    expect(eighthsPerBar('2/4')).toBe(4)
  })

  it('buildPatternSlots 映射 D/U/X/- 为扫弦事件', () => {
    const slots = buildPatternSlots('C', 'major', ['D', 'U', 'X', '-'])
    expect(slots).toHaveLength(4)
    // D：默认方向不写 strumDir
    expect(slots[0]).toMatchObject({ root: 'C', suffix: 'major', noteValue: 8 })
    expect(slots[0].strumDir).toBeUndefined()
    expect(slots[1].strumDir).toBe('U')
    expect(slots[2].strumDir).toBe('X')
    // 休止：无和弦
    expect(slots[3].root).toBeNull()
  })

  it('所有预设节奏型能为 4/4 生成整小节', () => {
    for (const preset of STRUM_PRESETS) {
      const strikes = preset.build(eighthsPerBar('4/4'))
      expect(strikes).toHaveLength(8)
      const slots = buildPatternSlots('G', 'major', strikes)
      expect(slots).toHaveLength(8)
      slots.forEach(s => expect(s.noteValue).toBe(8))
    }
  })
})
