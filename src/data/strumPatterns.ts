import type { ChordSlot, TimeSig } from '../types/audio'

// 常见扫弦节奏型：每个 strike 为一个八分音符 D=下 U=上 X=闷音 -=休止
export type Strike = 'D' | 'U' | 'X' | '-'

function cyc(motif: Strike[], n: number): Strike[] {
  return Array.from({ length: n }, (_, i) => motif[i % motif.length])
}

export interface StrumPreset {
  key: string
  label: string
  title: string
  build: (eighths: number) => Strike[]
}

export const STRUM_PRESETS: StrumPreset[] = [
  { key: 'q-down', label: '↓↓↓↓',      title: '四分下扫', build: n => Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 'D' : '-')) },
  { key: 'e-alt',  label: '↓↑↓↑',      title: '八分下上', build: n => Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 'D' : 'U')) },
  { key: 'folk',   label: '↓ ↓↑ ↑↓↑', title: '民谣节奏', build: n => cyc(['D', '-', 'D', 'U', '-', 'U', 'D', 'U'], n) },
  { key: 'mute',   label: '↓✕↓↑✕↑',   title: '切音节奏', build: n => cyc(['D', 'X', 'D', 'U', 'X', 'U', 'D', 'U'], n) },
]

// 每小节的八分音符数（决定节奏型长度）
export function eighthsPerBar(timeSig: TimeSig): number {
  if (timeSig === '4/4') return 8
  if (timeSig === '3/4' || timeSig === '6/8') return 6
  return 4  // 2/4
}

// 把一组 strike 转换成和弦事件（每个八分音符一个事件）
export function buildPatternSlots(root: string | null, suffix: string | null, strikes: Strike[]): ChordSlot[] {
  return strikes.map(st =>
    st === '-'
      ? { root: null, suffix: null, positionIndex: 0, noteValue: 8 }
      : { root, suffix, positionIndex: 0, noteValue: 8, ...(st !== 'D' ? { strumDir: st } : {}) }
  )
}
