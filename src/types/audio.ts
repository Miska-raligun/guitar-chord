import type { ChordPosition } from './chord'

export interface ChordMatch {
  root: string
  suffix: string
  confidence: number
  position: ChordPosition | null
}

// 53231323: 最常见民谣指法（5弦起拨）
// x3231323: 切音版指法（x=闷音击弦）
// strum:    扫弦 DDUUDU
export type ArpeggioPattern = '53231323' | 'x3231323' | 'strum'

export interface ArpeggioState {
  isPlaying: boolean
  bpm: number
  pattern: ArpeggioPattern
  activeString: number | null   // 指法拨弦高亮（0-5）
  isStrumBeat: boolean          // 扫弦节拍闪光（替代逐弦抖动）
}
