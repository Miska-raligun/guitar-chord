import { useState } from 'react'
import RootSelector from '../browse/RootSelector'
import SuffixSelector from '../browse/SuffixSelector'
import type { ChordSlot, TimeSig } from '../../types/audio'
import { useChordDb } from '../../hooks/useChordDb'
import { STRUM_PRESETS, eighthsPerBar, buildPatternSlots } from '../../data/strumPatterns'

interface Props {
  slot: ChordSlot
  isStrum: boolean
  timeSig: TimeSig
  onSelect: (slot: ChordSlot) => void
  onFillBar?: (slots: ChordSlot[]) => void
  onClose: () => void
}

const NOTE_VALUE_OPTIONS: { v: 1|2|4|8|16; label: string; title: string }[] = [
  { v: 1,  label: '全',  title: '全音符（1小节）' },
  { v: 2,  label: '半',  title: '二分音符（½小节）' },
  { v: 4,  label: '♩',   title: '四分音符（¼小节）' },
  { v: 8,  label: '♪',   title: '八分音符（⅛小节）' },
  { v: 16, label: '♬',   title: '十六分音符（1/16小节）' },
]

const STRUM_DIR_OPTIONS: { v: 'D'|'U'|'X'; label: string; title: string }[] = [
  { v: 'D', label: '↓', title: '下扫' },
  { v: 'U', label: '↑', title: '上扫' },
  { v: 'X', label: '✕', title: '闷音 / 切音' },
]

export default function ChordCellPicker({ slot, isStrum, timeSig, onSelect, onFillBar, onClose }: Props) {
  const { suffixes } = useChordDb()
  const [root,      setRoot]      = useState(slot.root ?? 'C')
  const [suffix,    setSuffix]    = useState(slot.suffix ?? 'major')
  const [noteValue, setNoteValue] = useState<1|2|4|8|16>(slot.noteValue ?? 1)
  const [strumDir,  setStrumDir]  = useState<'D'|'U'|'X'>(slot.strumDir ?? 'D')

  function commit(r: string, s: string, nv: 1|2|4|8|16, dir: 'D'|'U'|'X') {
    onSelect({
      root: r, suffix: s, positionIndex: 0,
      ...(nv > 1 ? { noteValue: nv } : {}),
      ...(isStrum && dir !== 'D' ? { strumDir: dir } : {}),
    })
  }

  function handleRoot(r: string) {
    setRoot(r)
    commit(r, suffix, noteValue, strumDir)
  }

  function handleSuffix(s: string) {
    setSuffix(s)
    commit(root, s, noteValue, strumDir)
  }

  function handleNoteValue(nv: 1|2|4|8|16) {
    setNoteValue(nv)
    commit(root, suffix, nv, strumDir)
  }

  function handleStrumDir(dir: 'D'|'U'|'X') {
    setStrumDir(dir)
    commit(root, suffix, noteValue, dir)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 border-t border-zinc-700 rounded-t-2xl shadow-2xl p-4 pb-8">
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

        {/* Note value + strum direction selectors — strum mode only */}
        {isStrum && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
            <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 shrink-0">扫法</span>
              <div className="flex rounded-lg overflow-hidden border border-zinc-700">
                {STRUM_DIR_OPTIONS.map(({ v, label, title }) => (
                  <button
                    key={v}
                    title={title}
                    onClick={() => handleStrumDir(v)}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      strumDir === v
                        ? 'bg-amber-500 text-zinc-950 font-semibold'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Rhythm-fill — turn this cell into a whole bar of the chosen chord strummed in a preset pattern */}
        {isStrum && onFillBar && (
          <div className="mb-3">
            <div className="text-xs text-zinc-500 mb-1.5">整小节节奏型（用当前和弦一键铺满本小节）</div>
            <div className="flex gap-1.5">
              {STRUM_PRESETS.map(({ key, label, title, build }) => (
                <button
                  key={key}
                  title={title}
                  onClick={() => {
                    onFillBar(buildPatternSlots(root, suffix, build(eighthsPerBar(timeSig))))
                    onClose()
                  }}
                  className="flex-1 h-10 rounded-lg border border-dashed border-zinc-700 bg-zinc-900 hover:border-amber-500/50 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 text-[11px] font-medium transition-all flex flex-col items-center justify-center leading-tight"
                >
                  <span>{title}</span>
                  <span className="text-[9px] text-zinc-600">{label}</span>
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
  )
}
