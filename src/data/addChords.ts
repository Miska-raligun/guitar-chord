import type { ChordPosition } from '../types/chord'
import { OPEN_MIDI } from '../utils/chordIdentify'

// add4 / add11 = 大三和弦 + 四度(=十一度)：音级 {R, M3, P4, P5}
// 弦序 index：0=低音E 1=A 2=D 3=G 4=B 5=高音e
// 说明：@techies23/react-chords 期望 frets 为"相对 baseFret"的品位，
// 而播放(getFreq)按绝对音高。因此这里同时给出相对 frets(用于显示) 和 6 位对齐的
// midi 数组(用于发声，-1=闷弦)。

const ROOTS_SEMI: Record<string, number> = {
  C: 0, 'C#': 1, D: 2, Eb: 3, E: 4, F: 5,
  'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11,
}

// 由每根弦的"绝对品位"（-1=闷弦，0=空弦）生成 ChordPosition
function makePosition(absFrets: number[], fingers: number[]): ChordPosition {
  const fretted = absFrets.filter(f => f > 0)
  const minF = fretted.length ? Math.min(...fretted) : 0
  const baseFret = minF > 1 ? minF : 1
  const frets = absFrets.map(f => (f < 0 ? -1 : f === 0 ? 0 : f - baseFret + 1))
  const midi = absFrets.map((f, i) => (f < 0 ? -1 : OPEN_MIDI[i] + f))
  return { frets, fingers, baseFret, barres: [], midi }
}

// E-shape（根音在 6 弦）：绝对品位 [b, b, b+2, b+1, b, b] = R P4 R M3 P5 R
function makeEShape(rootSemi: number): ChordPosition {
  const b = ((rootSemi - 4) % 12 + 12) % 12
  return makePosition([b, b, b + 2, b + 1, b, b], [1, 1, 3, 2, 1, 1])
}

// A-shape（根音在 5 弦，6 弦不弹）：绝对品位 [-1, a, a, a+2, a+2, a] = x R P4 R M3 P5
function makeAShape(rootSemi: number): ChordPosition {
  const a = ((rootSemi - 9) % 12 + 12) % 12
  return makePosition([-1, a, a, a + 2, a + 2, a], [0, 1, 1, 3, 4, 1])
}

// add4 与 add11 音级相同，共用同一组可移动指法
export const ADD_CHORD_POSITIONS: Record<string, ChordPosition[]> = Object.fromEntries(
  Object.entries(ROOTS_SEMI).map(([root, semi]) => [root, [makeEShape(semi), makeAShape(semi)]])
)
