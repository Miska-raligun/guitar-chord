import { describe, it, expect, beforeAll } from 'vitest'
import { encodeShareUrl, decodeShareUrl } from './shareUrl'
import type { ChordSlot, MelodyNote } from '../types/audio'

beforeAll(() => {
  ;(globalThis as Record<string, unknown>).window = { location: { href: 'https://example.com/app' } }
})

function param(url: string): string {
  return new URL(url).searchParams.get('s')!
}

describe('分享链接压缩', () => {
  it('长编曲被压缩（z 前缀）且能无损还原', () => {
    // 128 个扫弦事件 + 旋律：高度重复，压缩收益明显
    const chords: ChordSlot[] = Array.from({ length: 128 }, (_, i) => ({
      root: ['C', 'G', 'Am', 'F'][i % 4] === 'Am' ? 'A' : ['C', 'G', 'A', 'F'][i % 4],
      suffix: i % 4 === 2 ? 'minor' : 'major',
      positionIndex: 0,
      noteValue: 8 as const,
      ...(i % 2 ? { strumDir: 'U' as const } : {}),
    }))
    const melody: (MelodyNote | null)[][] = chords.map(() => Array(16).fill(null))
    melody[0][0] = { semitone: 0, duration: 2 }
    melody[5][2] = { semitone: 7, duration: 4, string: 1, fret: 3 }

    const state = { bpm: 120, pattern: 'strum' as const, keyRoot: 0, timeSig: '4/4' as const, noteDuration: 2 as const, capo: 2, chords, melody }
    const encoded = param(encodeShareUrl(state))
    expect(encoded.startsWith('z')).toBe(true)

    const plainLen = JSON.stringify(state).length
    expect(encoded.length).toBeLessThan(plainLen)

    const back = decodeShareUrl(encoded)!
    expect(back).not.toBeNull()
    expect(back.chords).toHaveLength(128)
    expect(back.chords[0]).toMatchObject({ root: 'C', suffix: 'major', noteValue: 8 })
    expect(back.chords[1].strumDir).toBe('U')
    expect(back.chords[2]).toMatchObject({ root: 'A', suffix: 'minor' })
    expect(back.capo).toBe(2)
    expect(back.melody[0][0]).toMatchObject({ semitone: 0, duration: 2 })
    expect(back.melody[5][2]).toMatchObject({ semitone: 7, duration: 4, string: 1, fret: 3 })
  })

  it('短编曲不压缩时仍可解码（向后兼容明文）', () => {
    const chords: ChordSlot[] = [{ root: 'C', suffix: 'major', positionIndex: 0 }]
    const melody = [Array(16).fill(null)]
    const encoded = param(encodeShareUrl({ bpm: 80, pattern: '53231323', keyRoot: 0, timeSig: '4/4', noteDuration: 2, chords, melody }))
    const back = decodeShareUrl(encoded)!
    expect(back.chords[0]).toMatchObject({ root: 'C', suffix: 'major' })
  })

  it('各种规模都能 roundtrip', () => {
    for (const n of [1, 7, 32, 64, 200]) {
      const chords: ChordSlot[] = Array.from({ length: n }, (_, i) => ({
        root: ['C','D','E','F','G','A','B'][i % 7], suffix: 'major', positionIndex: 0,
      }))
      const melody = chords.map(() => Array(16).fill(null))
      const back = decodeShareUrl(param(encodeShareUrl({
        bpm: 100, pattern: '53231323', keyRoot: 0, timeSig: '4/4', noteDuration: 2, chords, melody,
      })))!
      expect(back.chords).toHaveLength(n)
      expect(back.chords[n - 1].root).toBe(['C','D','E','F','G','A','B'][(n - 1) % 7])
    }
  })
})
