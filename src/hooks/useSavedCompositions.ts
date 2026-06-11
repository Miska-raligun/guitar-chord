import { useState } from 'react'
import type { SavedComposition } from '../types/compose'
import type { SequencerState } from '../types/audio'
import { COMPOSITIONS_LIST_KEY } from '../types/compose'

function loadList(): SavedComposition[] {
  try {
    return JSON.parse(localStorage.getItem(COMPOSITIONS_LIST_KEY) ?? '[]')
  } catch {
    return []
  }
}

function persist(list: SavedComposition[]): void {
  localStorage.setItem(COMPOSITIONS_LIST_KEY, JSON.stringify(list))
}

export function useSavedCompositions() {
  const [list, setList] = useState<SavedComposition[]>(loadList)

  function save(name: string, state: SequencerState): void {
    const item: SavedComposition = {
      id: Date.now().toString(),
      name: name.trim() || '未命名编曲',
      savedAt: Date.now(),
      bpm: state.bpm,
      pattern: state.pattern,
      keyRoot: state.keyRoot,
      timeSig: state.timeSig,
      chords: state.chords,
      melody: state.melody,
    }
    const next = [item, ...list]
    setList(next)
    persist(next)
  }

  function remove(id: string): void {
    const next = list.filter(c => c.id !== id)
    setList(next)
    persist(next)
  }

  return { list, save, remove }
}
