// 大调调内和弦（自然音三和弦）与常见进行建议

export interface DiatonicChord {
  degree: number                       // 0-6（级数 - 1）
  root: number                         // 音级 0-11
  suffix: 'major' | 'minor' | 'dim'
  numeral: string                      // 罗马数字标注
}

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]
const QUALITIES: DiatonicChord['suffix'][] = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'dim']
const NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']

export function diatonicChords(keyRoot: number): DiatonicChord[] {
  return MAJOR_SCALE.map((iv, i) => ({
    degree: i,
    root: (keyRoot + iv) % 12,
    suffix: QUALITIES[i],
    numeral: NUMERALS[i],
  }))
}

// 该级数后面最常接的级数（0-based），按常见度排序
const NEXT_DEGREES: number[][] = [
  [3, 4, 5, 1],  // I  → IV V vi ii
  [4, 6],        // ii → V vii°
  [5, 3],        // iii→ vi IV
  [4, 0, 1],     // IV → V I ii
  [0, 5, 3],     // V  → I vi IV
  [3, 1, 4],     // vi → IV ii V
  [0, 2],        // vii°→ I iii
]

export function nextDegreeSuggestions(degree: number): number[] {
  return NEXT_DEGREES[degree] ?? []
}

// 按根音找当前和弦对应的级数（不严格匹配性质，maj7/m7 等衍生和弦也算同级）
export function findDegreeByRoot(keyRoot: number, rootPc: number): DiatonicChord | null {
  return diatonicChords(keyRoot).find(c => c.root === rootPc) ?? null
}
