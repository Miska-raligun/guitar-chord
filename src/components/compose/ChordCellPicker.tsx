import { useState } from 'react'
import RootSelector from '../browse/RootSelector'
import SuffixSelector from '../browse/SuffixSelector'
import type { ChordSlot } from '../../types/audio'
import { useChordDb } from '../../hooks/useChordDb'

interface Props {
  slot: ChordSlot
  onSelect: (slot: ChordSlot) => void
  onClose: () => void
}

export default function ChordCellPicker({ slot, onSelect, onClose }: Props) {
  const { suffixes, getChordEntry } = useChordDb()
  const [root, setRoot] = useState(slot.root ?? 'C')
  const [suffix, setSuffix] = useState(slot.suffix ?? 'major')

  function commit(r: string, s: string) {
    getChordEntry(r, s)
    onSelect({ root: r, suffix: s, positionIndex: 0 })
  }

  function handleRoot(r: string) {
    setRoot(r)
    commit(r, suffix)
  }

  function handleSuffix(s: string) {
    setSuffix(s)
    commit(root, s)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-white border-t border-amber-200 rounded-t-2xl p-4 pb-8 shadow-xl shadow-amber-200/30"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-stone-400 uppercase tracking-wider">
            选择和弦
            {root && suffix && (
              <span className="ml-2 text-amber-600 normal-case font-semibold">
                {root} {suffix !== 'major' ? suffix : ''}
              </span>
            )}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => { onSelect({ root: null, suffix: null, positionIndex: 0 }); onClose() }}
              className="py-2 px-3 rounded-lg text-stone-400 text-sm hover:text-stone-600 hover:bg-amber-100"
            >
              清空
            </button>
            <button onClick={onClose} className="py-2 px-3 rounded-lg text-stone-400 text-sm hover:text-stone-600 hover:bg-amber-100">确定</button>
          </div>
        </div>

        <div className="mb-3">
          <RootSelector selected={root} onChange={handleRoot} />
        </div>

        <SuffixSelector suffixes={suffixes} selected={suffix} onChange={handleSuffix} />
      </div>
    </div>
  )
}
