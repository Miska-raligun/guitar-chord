import { useMemo } from 'react'
import guitarDb from '@tombatossals/chords-db/lib/guitar.json'
import type { GuitarDb, ChordEntry } from '../types/chord'
import { normalizeKey, ROOTS } from '../utils/dbUtils'
import { POWER_CHORD_DB } from '../data/powerChords'
import { ADD_CHORD_POSITIONS } from '../data/addChords'

const db = guitarDb as unknown as GuitarDb

export function useChordDb() {
  const keys = useMemo(() => ROOTS, [])
  // Insert '5' (power chord) after major/minor, and add4/add11 after add9 —
  // none of these exist in @tombatossals/chords-db.
  const suffixes = useMemo(() => {
    const withPower = [...db.suffixes.slice(0, 2), '5', ...db.suffixes.slice(2)]
    const i = withPower.indexOf('add9')
    if (i >= 0) withPower.splice(i + 1, 0, 'add4', 'add11')
    else withPower.push('add4', 'add11')
    return withPower
  }, [])

  function getChordEntry(root: string, suffix: string): ChordEntry | null {
    if (suffix === '5') return POWER_CHORD_DB[root] ?? null
    if (suffix === 'add4' || suffix === 'add11') {
      const positions = ADD_CHORD_POSITIONS[root]
      return positions ? { key: root, suffix, positions } : null
    }
    const dbKey = normalizeKey(root)
    const entries = db.chords[dbKey]
    if (!entries) return null
    return entries.find(e => e.suffix === suffix) ?? null
  }

  return { keys, suffixes, getChordEntry }
}
