// Maps display root names to the internal key used by @tombatossals/chords-db
export const DISPLAY_TO_DB_KEY: Record<string, string> = {
  C: 'C',
  'C#': 'Csharp',
  D: 'D',
  Eb: 'Eb',
  E: 'E',
  F: 'F',
  'F#': 'Fsharp',
  G: 'G',
  Ab: 'Ab',
  A: 'A',
  Bb: 'Bb',
  B: 'B',
}

export const DB_KEY_TO_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(DISPLAY_TO_DB_KEY).map(([k, v]) => [v, k])
)

// All 12 root notes in display order
export const ROOTS = Object.keys(DISPLAY_TO_DB_KEY)

export function normalizeKey(displayRoot: string): string {
  return DISPLAY_TO_DB_KEY[displayRoot] ?? displayRoot
}

export function prettifySuffix(suffix: string): string {
  const map: Record<string, string> = {
    '5': '强力和弦',
    major: '大调',
    minor: '小调',
    '7': '属七',
    maj7: '大七',
    m7: '小七',
    sus2: 'sus2',
    sus4: 'sus4',
    dim: '减和弦',
    aug: '增和弦',
    'm7b5': '半减七',
    dim7: '减七',
    add9: 'add9',
    '6': '六和弦',
    m6: '小六',
    '9': '九和弦',
    maj9: '大九',
    m9: '小九',
    '11': '十一',
    '13': '十三',
  }
  return map[suffix] ?? suffix
}
