import { useState } from 'react'
import RootSelector from '../browse/RootSelector'
import SuffixSelector from '../browse/SuffixSelector'
import type { ChordSlot } from '../../types/audio'
import { useChordDb } from '../../hooks/useChordDb'

interface Props {
  slot: ChordSlot
  isStrum: boolean
  onSelect: (slot: ChordSlot) => void
  onClose: () => void
}

const NOTE_VALUE_OPTIONS: { v: 1|2|4|8|16; label: string; title: string }[] = [
  { v: 1,  label: '全',  title: '全音符（1小节）' },
  { v: 2,  label: '半',  title: '二分音符（½小节）' },
  { v: 4,  label: '♩',   title: '四分音符（¼小节）' },
  { v: 8,  label: '♪',   title: '八分音符（⅛小节）' },
  { v: 16, label: '♬',   title: '十六分音符（1/16小节）' },
]

export default function ChordCellPicker({ slot, isStrum, onSelect, onClose }: Props) {
  const { suffixes } = useChordDb()
  const [root,      setRoot]      = useState(slot.root ?? 'C')
  const [suffix,    setSuffix]    = useState(slot.suffix ?? 'major')
  const [noteValue, setNoteValue] = useState<1|2|4|8|16>(slot.noteValue ?? 1)

  function commit(r: string, s: string, nv: 1|2|4|8|16) {
    onSelect({ root: r, suffix: s, positionIndex: 0, ...(nv > 1 ? { noteValue: nv } : {}) })
  }

  function handleRoot(r: string) {
    setRoot(r)
    commit(r, suffix, noteValue)
  }

  function handleSuffix(s: string) {
    setSuffix(s)
    commit(root, s, noteValue)
  }

  function handleNoteValue(nv: 1|2|4|8|16) {
    setNoteValue(nv)
    commit(root, suffix, nv)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-zinc-900 border-t border-zinc-700 rounded-t-2xl p-4 pb-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-zinc-400 uppercase tracking-wider">
            选择和弦
            {root && suffix && (
              <span className="ml-2 text-amber-400 normal-case font-semibold">
                {root} {suffix !== 'major' ? suffix : ''}
              </span>
            )}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => { onSelect({ root: null, suffix: null, positionIndex: 0 }); onClose() }}
              className="py-2 px-3 rounded-lg text-zinc-400 text-sm hover:text-zinc-200 hover:bg-zinc-800"
            >
              清空
            </button>
            <button onClick={onClose} className="py-2 px-3 rounded-lg text-zinc-400 text-sm hover:text-zinc-200 hover:bg-zinc-800">确定</button>
          </div>
        </div>

        {/* Note value selector — strum mode only */}
        {isStrum && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-zinc-500 shrink-0">时值</span>
            <div className="flex rounded-lg overflow-hidden border border-zinc-700">
              {NOTE_VALUE_OPTIONS.map(({ v, label, title }) => (
                <button
                  key={v}
                  title={title}
                  onClick={() => handleNoteValue(v)}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    noteValue === v
                      ? 'bg-amber-500 text-zinc-950 font-semibold'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-3">
          <RootSelector selected={root} onChange={handleRoot} />
        </div>

        <SuffixSelector suffixes={suffixes} selected={suffix} onChange={handleSuffix} />
      </div>
    </div>
  )
}
