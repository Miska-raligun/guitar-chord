import { useMemo } from 'react'
import guitarDb from '@tombatossals/chords-db/lib/guitar.json'
import type { GuitarDb, ChordEntry } from '../types/chord'
import { normalizeKey, ROOTS } from '../utils/dbUtils'

const db = guitarDb as unknown as GuitarDb

export function useChordDb() {
  const keys = useMemo(() => ROOTS, [])
  const suffixes = useMemo(() => db.suffixes, [])

  function getChordEntry(root: string, suffix: string): ChordEntry | null {
    const dbKey = normalizeKey(root)
    const entries = db.chords[dbKey]
    if (!entries) return null
    return entries.find(e => e.suffix === suffix) ?? null
  }

  return { keys, suffixes, getChordEntry }
}
