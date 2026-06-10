import type { ChordPosition } from './chord'

export interface ChordMatch {
  root: string
  suffix: string
  confidence: number
  position: ChordPosition | null
}

export type ArpeggioPattern = 'folk' | 'classical' | 'pop'

export interface ArpeggioState {
  isPlaying: boolean
  bpm: number
  pattern: ArpeggioPattern
  activeString: number | null
}
