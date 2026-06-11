import type { SequencerState } from '../types/audio'

// ── lookup tables (order is part of the format — do not reorder) ────────────

const PATTERNS = ['53231323', 'x3231323', '3_12_3', 'strum'] as const
const TIMESIGS = ['4/4', '3/4', '6/8', '2/4'] as const
const ROOTS    = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'] as const
const SUFFIXES = [
  // common (AI-generated and most user picks)
  'major','minor','7','maj7','m7','sus2','sus4','dim','aug','m7b5',
  'dim7','add9','6','m6','9','maj9','m9','11','maj11','m11',
  '13','maj13','m13','7sus4','7sus2','5',
  // extras from chords-db guitar.json
  'mmaj7','add2','sus','b5','aug7','9sus4','7b5','13b9','m6add9',
  'madd9','maj7#11','69','7#9','7b9',
] as const

// ── compact types ────────────────────────────────────────────────────────────

// Chord: null (empty bar) | [root_idx 0-11, suffix_idx 0-N]
type CChord = [number, number] | null
// Melody note: [bar, masterSlot, semitone, duration] — sparse, only non-null entries
type CNote  = [number, number, number, number]

interface Compact {
  b: number   // bpm
  p: number   // pattern index
  k: number   // keyRoot
  t: number   // timeSig index
  d: number   // noteDuration
  c: CChord[] // chords
  m: CNote[]  // melody (sparse)
}

type SharePayload = Pick<
  SequencerState,
  'bpm' | 'pattern' | 'keyRoot' | 'timeSig' | 'noteDuration' | 'chords' | 'melody'
>

// ── base64url helpers ────────────────────────────────────────────────────────

function toBase64url(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  bytes.forEach(b => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function fromBase64url(b64: string): string {
  const pad    = b64.length % 4
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad ? 4 - pad : 0)
  const bin    = atob(padded)
  const bytes  = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

// ── encode ───────────────────────────────────────────────────────────────────

export function encodeShareUrl(state: SharePayload): string {
  const compact: Compact = {
    b: state.bpm,
    p: Math.max(0, PATTERNS.indexOf(state.pattern as typeof PATTERNS[number])),
    k: state.keyRoot,
    t: Math.max(0, TIMESIGS.indexOf(state.timeSig as typeof TIMESIGS[number])),
    d: state.noteDuration,
    c: state.chords.map(slot => {
      if (!slot.root || !slot.suffix) return null
      const r = ROOTS.indexOf(slot.root as typeof ROOTS[number])
      const s = SUFFIXES.indexOf(slot.suffix as typeof SUFFIXES[number])
      if (r === -1 || s === -1) return null
      return [r, s]
    }),
    m: [],
  }

  // Sparse melody: only store non-null notes
  state.melody.forEach((bar, barIdx) => {
    bar.forEach((note, slot) => {
      if (note) compact.m.push([barIdx, slot, note.semitone, note.duration])
    })
  })

  const encoded = toBase64url(JSON.stringify(compact))
  const url = new URL(window.location.href)
  url.search = `?s=${encoded}`
  return url.toString()
}

// ── decode ───────────────────────────────────────────────────────────────────

export function decodeShareUrl(encoded: string): SharePayload | null {
  try {
    const obj = JSON.parse(fromBase64url(encoded))

    // Detect compact format (has numeric `p` field) vs old verbose format
    if (typeof obj.p === 'number') {
      // ── compact format ──
      const numBars = Array.isArray(obj.c) ? obj.c.length : 8
      const melody: SharePayload['melody'] = Array.from({ length: numBars }, () =>
        Array(16).fill(null)
      )
      if (Array.isArray(obj.m)) {
        for (const [bar, slot, semi, dur] of obj.m as CNote[]) {
          if (melody[bar]) melody[bar][slot] = { semitone: semi, duration: dur }
        }
      }
      return {
        bpm:          typeof obj.b === 'number' ? obj.b : 80,
        pattern:      PATTERNS[obj.p] ?? '53231323',
        keyRoot:      typeof obj.k === 'number' ? obj.k : 0,
        timeSig:      TIMESIGS[obj.t] ?? '4/4',
        noteDuration: obj.d ?? 2,
        chords: Array.isArray(obj.c)
          ? (obj.c as CChord[]).map(ch =>
              ch
                ? { root: ROOTS[ch[0]] ?? 'C', suffix: SUFFIXES[ch[1]] ?? 'major', positionIndex: 0 }
                : { root: null, suffix: null, positionIndex: 0 }
            )
          : [],
        melody,
      }
    }

    // ── legacy verbose format (backward compat) ──
    return {
      bpm:          obj.bpm          ?? 80,
      pattern:      obj.pattern      ?? '53231323',
      keyRoot:      obj.keyRoot      ?? 0,
      timeSig:      obj.timeSig      ?? '4/4',
      noteDuration: obj.noteDuration ?? 2,
      chords:       obj.chords       ?? [],
      melody:       obj.melody       ?? [],
    }
  } catch {
    return null
  }
}
