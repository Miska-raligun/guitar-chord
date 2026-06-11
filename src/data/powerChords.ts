import type { ChordEntry, ChordPosition } from '../types/chord'

const ROOTS_SEMI: Record<string, number> = {
  C: 0, 'C#': 1, D: 2, Eb: 3, E: 4, F: 5,
  'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11,
}

// E-shape: root on string 6 (E2 = semi 4), 5th + octave on strings 5, 4
// Frets are absolute (karplusStrong uses OPEN_STRING_FREQS[i] * 2^(fret/12))
function makeEShape(rootSemi: number): ChordPosition {
  const eFret = (rootSemi - 4 + 12) % 12
  return {
    frets: [eFret, eFret + 2, eFret + 2, -1, -1, -1],
    fingers: [1, 3, 4, 0, 0, 0],
    baseFret: eFret || 1,
    barres: [],
  }
}

// A-shape: root on string 5 (A2 = semi 9), 5th + octave on strings 4, 3
function makeAShape(rootSemi: number): ChordPosition {
  const aFret = (rootSemi - 9 + 12) % 12
  return {
    frets: [-1, aFret, aFret + 2, aFret + 2, -1, -1],
    fingers: [0, 1, 3, 4, 0, 0],
    baseFret: aFret || 1,
    barres: [],
  }
}

export const POWER_CHORD_DB: Record<string, ChordEntry> = Object.fromEntries(
  Object.entries(ROOTS_SEMI).map(([root, semi]) => [
    root,
    {
      key: root,
      suffix: '5',
      positions: [makeEShape(semi), makeAShape(semi)],
    },
  ])
)
