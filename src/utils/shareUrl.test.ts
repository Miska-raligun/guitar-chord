import { describe, it, expect, beforeAll } from 'vitest'
import { encodeShareUrl, decodeShareUrl } from './shareUrl'
import type { ChordSlot, MelodyNote } from '../types/audio'

// encodeShareUrl 读取 window.location.href —— node 环境下打桩
beforeAll(() => {
  ;(globalThis as Record<string, unknown>).window = {
    location: { href: 'https://example.com/app' },
  }
})

function extractParam(url: string): string {
  return new URL(url).searchParams.get('s')!
}

describe('shareUrl 编解码', () => {
  it('roundtrip：普通指法模式内容', () => {
    const chords: ChordSlot[] = [
      { root: 'C', suffix: 'major', positionIndex: 0 },
      { root: 'A', suffix: 'minor', positionIndex: 0 },
      { root: null, suffix: null, positionIndex: 0 },
    ]
    const melody: (MelodyNote | null)[][] = [
      Array(16).fill(null),
      Array(16).fill(null),
      Array(16).fill(null),
    ]
    melody[0][0] = { semitone: 0, duration: 2 }
    melody[1][4] = { semitone: 7, duration: 4, string: 2, fret: 5 }

    const url = encodeShareUrl({
      bpm: 96, pattern: '53231323', keyRoot: 0, timeSig: '4/4', noteDuration: 2,
      chords, melody,
    })
    const decoded = decodeShareUrl(extractParam(url))!
    expect(decoded).not.toBeNull()
    expect(decoded.bpm).toBe(96)
    expect(decoded.pattern).toBe('53231323')
    expect(decoded.timeSig).toBe('4/4')
    expect(decoded.chords[0]).toMatchObject({ root: 'C', suffix: 'major' })
    expect(decoded.chords[1]).toMatchObject({ root: 'A', suffix: 'minor' })
    expect(decoded.chords[2].root).toBeNull()
    expect(decoded.melody[0][0]).toMatchObject({ semitone: 0, duration: 2 })
    // 带指板位置的旋律音保留 string/fret
    expect(decoded.melody[1][4]).toMatchObject({ semitone: 7, duration: 4, string: 2, fret: 5 })
  })

  it('roundtrip：扫弦模式 noteValue + strumDir', () => {
    const chords: ChordSlot[] = [
      { root: 'G', suffix: 'major', positionIndex: 0, noteValue: 8 },
      { root: 'G', suffix: 'major', positionIndex: 0, noteValue: 8, strumDir: 'U' },
      { root: 'D', suffix: '7', positionIndex: 0, noteValue: 4, strumDir: 'X' },
    ]
    const melody = chords.map(() => Array(16).fill(null))
    const url = encodeShareUrl({
      bpm: 120, pattern: 'strum', keyRoot: 7, timeSig: '4/4', noteDuration: 2,
      chords, melody,
    })
    const decoded = decodeShareUrl(extractParam(url))!
    expect(decoded.pattern).toBe('strum')
    expect(decoded.chords[0]).toMatchObject({ root: 'G', noteValue: 8 })
    expect(decoded.chords[0].strumDir).toBeUndefined()  // D 方向不存储
    expect(decoded.chords[1]).toMatchObject({ noteValue: 8, strumDir: 'U' })
    expect(decoded.chords[2]).toMatchObject({ root: 'D', suffix: '7', noteValue: 4, strumDir: 'X' })
  })

  it('roundtrip：capo 品位（0 时省略字段）', () => {
    const chords: ChordSlot[] = [{ root: 'C', suffix: 'major', positionIndex: 0 }]
    const melody = [Array(16).fill(null)]
    const base = { bpm: 80, pattern: '53231323' as const, keyRoot: 0, timeSig: '4/4' as const, noteDuration: 2 as const, chords, melody }
    const withCapo = decodeShareUrl(extractParam(encodeShareUrl({ ...base, capo: 3 })))!
    expect(withCapo.capo).toBe(3)
    const noCapo = decodeShareUrl(extractParam(encodeShareUrl(base)))!
    expect(noCapo.capo ?? 0).toBe(0)
  })

  it('无效输入返回 null', () => {
    expect(decodeShareUrl('not-base64!!!')).toBeNull()
    expect(decodeShareUrl('')).toBeNull()
  })
})
