import { useMemo } from 'react'
import guitarDb from '@tombatossals/chords-db/lib/guitar.json'
import type { GuitarDb, ChordEntry } from '../types/chord'
import { normalizeKey, ROOTS } from '../utils/dbUtils'
import { POWER_CHORD_DB } from '../data/powerChords'

const db = guitarDb as unknown as GuitarDb

export function useChordDb() {
  const keys = useMemo(() => ROOTS, [])
  // Insert '5' (power chord) right after major and minor for discoverability
  const suffixes = useMemo(() => {
    const base = db.suffixes
    return [...base.slice(0, 2), '5', ...base.slice(2)]
  }, [])

  function getChordEntry(root: string, suffix: string): ChordEntry | null {
    if (suffix === '5') return POWER_CHORD_DB[root] ?? null
    const dbKey = normalizeKey(root)
    const entries = db.chords[dbKey]
    if (!entries) return null
    return entries.find(e => e.suffix === suffix) ?? null
  }

  return { keys, suffixes, getChordEntry }
}
