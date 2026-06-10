import type { ChordPosition } from './chord'

export interface ChordMatch {
  root: string
  suffix: string
  confidence: number
  position: ChordPosition | null
}

// ─── 自定义节奏型步骤 ─────────────────────────────────────────
// '—'  = 休止（静音）
// '根' = 自动识别根音弦，正常拨
// 'x'  = 自动识别根音弦，闷音
// '1'~'6' = 吉他弦序（1=高音E, 6=低音E）
// '12' = 1弦+2弦同时拨
// '↓'  = 下扫弦，'↑' = 上扫弦
export type CustomStepKind = '—' | '根' | 'x' | '1' | '2' | '3' | '4' | '5' | '6' | '12' | '↓' | '↑'
// 拍号：决定每步的时长
// 2/4、3/4 → 每步一个四分音符（60/bpm 秒）
// 4/4、6/8 → 每步一个八分音符（60/bpm/2 秒）
export type TimeSig = '2/4' | '3/4' | '4/4' | '6/8'

export interface CustomConfig {
  steps: CustomStepKind[]
  timeSig: TimeSig
}

// ─── 内置节奏型 ──────────────────────────────────────────────
export type ArpeggioPattern = '53231323' | 'x3231323' | '3_12_3' | 'strum' | 'custom'

export interface ArpeggioState {
  isPlaying: boolean
  bpm: number
  pattern: ArpeggioPattern
  activeString: number | number[] | null  // 支持多弦同时高亮
  isStrumBeat: boolean
}
