import { SUFFIX_INTERVALS } from '../data/chordTemplates'
import { NOTE_NAMES } from './noteUtils'

// 标准调音各弦空弦 MIDI（0=低音E … 5=高音e）：E2 A2 D3 G3 B3 E4
export const OPEN_MIDI = [40, 45, 50, 55, 59, 64]

// 后缀显示：大调不显示、小调用 m、其余原样
function suffixLabel(suffix: string): string {
  if (suffix === 'major') return ''
  if (suffix === 'minor') return 'm'
  return suffix
}

// 优先级：越靠前越"常见/简单"，用于同一低音下的多解排序
const SUFFIX_PRIORITY = [
  '5', 'major', 'minor', '7', 'm7', 'maj7', 'sus4', 'sus2', '6', 'm6',
  'dim', 'aug', 'm7b5', 'dim7', 'add9', '9', 'maj9', 'm9',
  '7sus4', '7sus2', '11', 'm11', 'maj11', '13', 'm13', 'maj13',
]
function prio(suffix: string): number {
  const i = SUFFIX_PRIORITY.indexOf(suffix)
  return i === -1 ? 999 : i
}

export interface ChordCandidate {
  root: number
  suffix: string
  isSlash: boolean
  name: string
}

export interface IdentifyResult {
  name: string | null          // 主判定名称，如 "C" / "Am7" / "C/E"；无匹配为 null
  root: number | null
  suffix: string | null
  bass: number | null          // 低音音级
  isSlash: boolean
  isSingleNote: boolean
  notes: number[]              // 参与发声的去重音级（升序）
  soundingCount: number        // 实际发声的弦数
  candidates: ChordCandidate[] // 其他可能解读（不含主判定）
}

const EMPTY: IdentifyResult = {
  name: null, root: null, suffix: null, bass: null,
  isSlash: false, isSingleNote: false, notes: [], soundingCount: 0, candidates: [],
}

function nameOf(root: number, suffix: string, bass: number): string {
  const base = `${NOTE_NAMES[root]}${suffixLabel(suffix)}`
  return root === bass ? base : `${base}/${NOTE_NAMES[bass]}`
}

/**
 * 根据每根弦所按品位识别和弦。
 * frets[i]：该弦所按品位（0=空弦），null 或 <0 表示闷弦（不发声）。
 */
export function identifyChord(frets: (number | null)[]): IdentifyResult {
  const sounding: { pc: number; midi: number }[] = []
  frets.forEach((f, i) => {
    if (f === null || f < 0) return
    const midi = OPEN_MIDI[i] + f
    sounding.push({ pc: ((midi % 12) + 12) % 12, midi })
  })
  if (sounding.length === 0) return EMPTY

  const bass = sounding.reduce((a, b) => (b.midi < a.midi ? b : a)).pc
  const pcs = [...new Set(sounding.map(s => s.pc))].sort((a, b) => a - b)

  if (pcs.length === 1) {
    return {
      name: NOTE_NAMES[pcs[0]], root: pcs[0], suffix: null, bass,
      isSlash: false, isSingleNote: true, notes: pcs, soundingCount: sounding.length, candidates: [],
    }
  }

  const pcSet = new Set(pcs)
  const matches: { root: number; suffix: string }[] = []
  for (let root = 0; root < 12; root++) {
    if (!pcSet.has(root)) continue
    const intervals = new Set(pcs.map(pc => ((pc - root) % 12 + 12) % 12))
    for (const [suffix, ivs] of Object.entries(SUFFIX_INTERVALS)) {
      if (ivs.length !== intervals.size) continue
      if (ivs.every(iv => intervals.has(iv))) matches.push({ root, suffix })
    }
  }

  if (matches.length === 0) {
    return { ...EMPTY, bass, notes: pcs, soundingCount: sounding.length }
  }

  matches.sort((a, b) => {
    const bassRank = (a.root === bass ? 0 : 1) - (b.root === bass ? 0 : 1)
    if (bassRank !== 0) return bassRank
    return prio(a.suffix) - prio(b.suffix)
  })

  const best = matches[0]
  const candidates: ChordCandidate[] = matches.slice(1).map(m => ({
    root: m.root, suffix: m.suffix, isSlash: m.root !== bass, name: nameOf(m.root, m.suffix, bass),
  }))

  return {
    name: nameOf(best.root, best.suffix, bass),
    root: best.root,
    suffix: best.suffix,
    bass,
    isSlash: best.root !== bass,
    isSingleNote: false,
    notes: pcs,
    soundingCount: sounding.length,
    candidates,
  }
}
