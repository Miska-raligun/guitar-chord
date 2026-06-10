import type { ChordPosition } from './chord'

export interface ChordMatch {
  root: string
  suffix: string
  confidence: number
  position: ChordPosition | null
}

// 节奏型标识
// '53231323' : 根音（自动识别弦）+ 3231323 高音弦，根音正常拨
// 'x3231323' : 根音（自动识别弦，闷音）+ 3231323 高音弦
// '3_12_3'   : 根音 + 3弦 + (1弦+2弦同时) + 3弦，每步四分音符
// 'strum'    : DDUUDU 扫弦
export type ArpeggioPattern = '53231323' | 'x3231323' | '3_12_3' | 'strum'

export interface ArpeggioState {
  isPlaying: boolean
  bpm: number
  pattern: ArpeggioPattern
  activeString: number | null   // 指法单弦高亮（0-5）
  isStrumBeat: boolean          // 扫弦/切音整体闪光
}
