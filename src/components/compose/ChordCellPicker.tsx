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

const BAR_OPTIONS = [1, 2, 3, 4]

export default function ChordCellPicker({ slot, onSelect, onClose }: Props) {
  const { suffixes } = useChordDb()
  const [root,     setRoot]     = useState(slot.root ?? 'C')
  const [suffix,   setSuffix]   = useState(slot.suffix ?? 'major')
  const [barCount, setBarCount] = useState(slot.bars ?? 1)

  function commit(r: string, s: string, bc: number) {
    onSelect({ root: r, suffix: s, positionIndex: 0, ...(bc > 1 ? { bars: bc } : {}) })
  }

  function handleRoot(r: string) {
    setRoot(r)
    commit(r, suffix, barCount)
  }

  function handleSuffix(s: string) {
    setSuffix(s)
    commit(root, s, barCount)
  }

  function handleBars(bc: number) {
    setBarCount(bc)
    commit(root, suffix, bc)
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

        {/* Bar span selector */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-zinc-500 shrink-0">占用小节</span>
          <div className="flex rounded-lg overflow-hidden border border-zinc-700">
            {BAR_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => handleBars(n)}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  barCount === n
                    ? 'bg-amber-500 text-zinc-950 font-semibold'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {n}
              </button>
            ))}
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
