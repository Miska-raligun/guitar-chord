import { useState } from 'react'
import { useSequencer } from '../../hooks/useSequencer'
import { useSavedCompositions } from '../../hooks/useSavedCompositions'
import SequencerGrid from './SequencerGrid'
import AiPanel from './AiPanel'
import SaveNameModal from './SaveNameModal'
import SavedList from './SavedList'
import type { AiComposition } from '../../hooks/useAiCompose'
import type { SavedComposition } from '../../types/compose'
import type { SequencerState } from '../../types/audio'
import { ROOTS } from '../../utils/dbUtils'

const PATTERNS: { id: SequencerState['pattern']; label: string }[] = [
  { id: '53231323', label: '民谣' },
  { id: 'x3231323', label: '闷音' },
  { id: '3_12_3',   label: '古典' },
  { id: 'strum',    label: '扫弦' },
]

type Panel = 'ai' | 'save' | 'library' | null

export default function ComposeTab() {
  const { state, setChordSlot, setMelodyNote, setBpm, setPattern, setKeyRoot, play, stop } = useSequencer()
  const { list: savedList, save: saveComposition, remove: removeComposition } = useSavedCompositions()
  const [panel, setPanel] = useState<Panel>(null)
  const { isPlaying, bpm, pattern, keyRoot } = state

  function applyComposition(src: AiComposition | SavedComposition) {
    stop()
    setBpm(src.bpm)
    setPattern(src.pattern)
    setKeyRoot(src.keyRoot)
    src.chords.forEach((slot, i)   => setChordSlot(i, slot))
    src.melody.forEach((bar, i)    => bar.forEach((note, j) => setMelodyNote(i, j, note)))
  }

  function handleAiResult(result: AiComposition) {
    applyComposition(result)
  }

  function handleLoad(item: SavedComposition) {
    applyComposition(item)
  }

  function handleSave(name: string) {
    saveComposition(name, state)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Control bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-500 uppercase">调</span>
          <select
            value={keyRoot}
            onChange={e => setKeyRoot(Number(e.target.value))}
            className="bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 border border-zinc-700 outline-none"
          >
            {ROOTS.map((r, i) => (
              <option key={r} value={i}>{r}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          {PATTERNS.map(p => (
            <button
              key={p.id}
              onClick={() => setPattern(p.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                pattern === p.id
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] text-zinc-500">BPM</span>
          <input
            type="number"
            min={40}
            max={200}
            value={bpm}
            onChange={e => setBpm(Math.max(40, Math.min(200, Number(e.target.value))))}
            className="w-14 bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 border border-zinc-700 outline-none text-center"
          />
        </div>
      </div>

      {/* Action row */}
      <div className="flex gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <button
          onClick={() => setPanel('ai')}
          className="flex-1 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700 transition-colors"
        >
          🤖 AI 创作
        </button>
        <button
          onClick={() => setPanel('save')}
          className="flex-1 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700 transition-colors"
        >
          💾 保存
        </button>
        <button
          onClick={() => setPanel('library')}
          className="flex-1 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700 transition-colors"
        >
          📁 曲库{savedList.length > 0 && <span className="ml-1 text-amber-400">({savedList.length})</span>}
        </button>
      </div>

      {/* Sequencer grid */}
      <div className="flex-1 overflow-y-auto py-4">
        <SequencerGrid
          state={state}
          onChordChange={setChordSlot}
          onMelodyChange={setMelodyNote}
        />

        {state.chords.every(c => c.root === null) && (
          <p className="text-center text-zinc-600 text-xs mt-6 px-8">
            点击格子选择和弦，点击下方小格添加旋律音，或用 AI 一键生成
          </p>
        )}
      </div>

      {/* Play / Stop */}
      <div className="flex gap-3 px-6 py-4 bg-zinc-900 border-t border-zinc-800 justify-center">
        {!isPlaying ? (
          <button
            onClick={play}
            className="flex-1 max-w-xs py-3 rounded-xl bg-amber-500 text-zinc-950 font-semibold text-sm hover:bg-amber-400 transition-colors"
          >
            ▶ 循环播放
          </button>
        ) : (
          <button
            onClick={stop}
            className="flex-1 max-w-xs py-3 rounded-xl bg-zinc-700 text-zinc-200 font-semibold text-sm hover:bg-zinc-600 transition-colors"
          >
            ⏹ 停止
          </button>
        )}
      </div>

      {/* Panels */}
      {panel === 'ai' && (
        <AiPanel
          onGenerate={handleAiResult}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'save' && (
        <SaveNameModal
          onSave={handleSave}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'library' && (
        <SavedList
          list={savedList}
          onLoad={handleLoad}
          onDelete={removeComposition}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  )
}
