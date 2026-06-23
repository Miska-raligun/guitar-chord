// ─── 音阶配置 ──────────────────────────────────────────────────
export const SCALE_OPTIONS = [
  { key: 'all',        label: '全部',    intervals: null },
  { key: 'major',      label: '大调',    intervals: [0, 2, 4, 5, 7, 9, 11] },
  { key: 'natMinor',   label: '自然小调', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { key: 'majorPenta', label: '大调五声', intervals: [0, 2, 4, 7, 9] },
  { key: 'minorPenta', label: '小调五声', intervals: [0, 3, 5, 7, 10] },
  { key: 'blues',      label: '布鲁斯',  intervals: [0, 3, 5, 6, 7, 10] },
] as const

export type ScaleKey = typeof SCALE_OPTIONS[number]['key']

// ─── 常量 ─────────────────────────────────────────────────────
export const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]
export const SOLFEGE = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si']
export const NUMS    = ['1',  '2',  '3',  '4',  '5',   '6',  '7' ]

export const SINGLE_DOTS = new Set([3, 5, 7, 9, 15, 17, 19, 21])
export const DOUBLE_DOTS = new Set([12, 24])

// ─── 工具 ─────────────────────────────────────────────────────
export function getNoteInfo(semitone: number, keyRoot: number) {
  const interval = (semitone - keyRoot + 12) % 12
  const dIdx = MAJOR_INTERVALS.indexOf(interval)
  if (dIdx !== -1) {
    return { solfege: SOLFEGE[dIdx], num: NUMS[dIdx], isDiatonic: true, isRoot: interval === 0 }
  }
  let lowerIdx = 0
  for (let i = MAJOR_INTERVALS.length - 1; i >= 0; i--) {
    if (MAJOR_INTERVALS[i] < interval) { lowerIdx = i; break }
  }
  return { solfege: '♯' + SOLFEGE[lowerIdx], num: '♯' + NUMS[lowerIdx], isDiatonic: false, isRoot: false }
}
