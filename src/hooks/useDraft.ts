import { useEffect, useRef } from 'react'
import type { ChordSlot, MelodyNote, SequencerState, TimeSig } from '../types/audio'

const DRAFT_KEY = 'guitar-chord-draft'
const SAVE_DEBOUNCE_MS = 600

export interface Draft {
  bpm: number
  pattern: SequencerState['pattern']
  keyRoot: number
  timeSig: TimeSig
  noteDuration: SequencerState['noteDuration']
  capo?: number
  chords: ChordSlot[]
  melody: (MelodyNote | null)[][]
}

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (!Array.isArray(d.chords) || !Array.isArray(d.melody)) return null
    // 空草稿（没有任何和弦和旋律音）不值得恢复
    const hasContent = d.chords.some((c: ChordSlot) => c?.root)
      || d.melody.some((row: (MelodyNote | null)[]) => Array.isArray(row) && row.some(n => n))
    return hasContent ? d as Draft : null
  } catch {
    return null
  }
}

export function clearDraft(): void {
  try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
}

// 防抖地把当前编曲内容存为草稿。enabled=false 时（如恢复完成前）不写入。
export function useDraftAutosave(state: SequencerState, enabled: boolean): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { bpm, pattern, keyRoot, timeSig, noteDuration, capo, chords, melody } = state

  useEffect(() => {
    if (!enabled) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const draft: Draft = { bpm, pattern, keyRoot, timeSig, noteDuration, capo, chords, melody }
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)) } catch { /* ignore */ }
    }, SAVE_DEBOUNCE_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [enabled, bpm, pattern, keyRoot, timeSig, noteDuration, capo, chords, melody])
}
