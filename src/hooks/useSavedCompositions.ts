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

function isValidItem(obj: unknown): obj is SavedComposition {
  if (!obj || typeof obj !== 'object') return false
  const c = obj as Record<string, unknown>
  return (
    typeof c.name === 'string' &&
    typeof c.bpm === 'number' &&
    typeof c.keyRoot === 'number' &&
    Array.isArray(c.chords) &&
    Array.isArray(c.melody)
  )
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
      noteDuration: state.noteDuration,
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

  function exportAll(): void {
    const json = JSON.stringify(list, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `guitar-chord-compositions-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importFrom(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const raw = JSON.parse(e.target?.result as string)
          const arr: unknown[] = Array.isArray(raw) ? raw : [raw]
          const base = Date.now()
          const imported: SavedComposition[] = arr
            .filter(isValidItem)
            .map((c, i) => ({
              ...c,
              // assign fresh IDs to avoid collisions with existing entries
              id: (base + i).toString(),
              savedAt: c.savedAt ?? base,
            }))
          if (imported.length === 0) {
            reject(new Error('文件中没有找到有效的编曲数据'))
            return
          }
          const next = [...imported, ...list]
          setList(next)
          persist(next)
          resolve(imported.length)
        } catch {
          reject(new Error('文件格式无效，请选择正确的 JSON 文件'))
        }
      }
      reader.onerror = () => reject(new Error('读取文件失败'))
      reader.readAsText(file)
    })
  }

  return { list, save, remove, exportAll, importFrom }
}
