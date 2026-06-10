export interface ChordPosition {
  frets: number[]
  fingers: number[]
  baseFret: number
  barres: number[]
  capo?: boolean
  midi?: number[]
}

export interface ChordEntry {
  key: string
  suffix: string
  positions: ChordPosition[]
}

export interface GuitarDb {
  main: {
    strings: number
    fretsOnChord: number
    name: string
    numberOfChords: number
  }
  tunings: { standard: string[] }
  keys: string[]
  suffixes: string[]
  chords: Record<string, ChordEntry[]>
}

export const GUITAR_INSTRUMENT = {
  strings: 6,
  fretsOnChord: 4,
  tunings: { standard: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
}

// Open string frequencies in Hz (E2, A2, D3, G3, B3, E4)
export const OPEN_STRING_FREQS = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63]
