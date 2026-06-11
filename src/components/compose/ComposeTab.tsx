import { useState } from 'react'
import { useSequencer } from '../../hooks/useSequencer'
import { useSavedCompositions } from '../../hooks/useSavedCompositions'
import SequencerGrid from './SequencerGrid'
import AiPanel from './AiPanel'
import SaveNameModal from './SaveNameModal'
import SavedList from './SavedList'
import { IconPlay, IconStop, IconWand, IconSave, IconLibrary } from '../ui/icons'
import type { AiComposition } from '../../hooks/useAiCompose'
import type { SavedComposition } from '../../types/compose'
import type { SequencerState } from '../../types/audio'
import { ROOTS } from '../../utils/dbUtils'

const PATTERNS: { id: SequencerState['pattern']; label: string }[] = [
  { id: '53231323', label: '民谣' },
  { id: 'x3231323', label: '切音' },
  { id: '3_12_3',   label: '古典' },
  { id: 'strum',    label: '扫弦' },
]

type Panel = 'ai' | 'save' | 'library' | null

export default function ComposeTab() {
  const { state, setChordSlot, setMelodyNote, setBpm, setPattern, setKeyRoot, setTimeSig, setNoteDuration, addBar, removeLastBar, clearAll, play, stop } = useSequencer()
  const { list: savedList, save: saveComposition, remove: removeComposition } = useSavedCompositions()
  const [panel, setPanel] = useState<Panel>(null)
  const { isPlaying, bpm, pattern, keyRoot, timeSig, noteDuration } = state

  function applyComposition(src: AiComposition | SavedComposition) {
    clearAll()
    setBpm(src.bpm)
    setPattern(src.pattern)
    setKeyRoot(src.keyRoot)
    if (src.timeSig) setTimeSig(src.timeSig)
    if ('noteDuration' in src && src.noteDuration) setNoteDuration(src.noteDuration)
    src.chords.forEach((slot, i) => setChordSlot(i, slot))
    src.melody.forEach((bar, i) => bar.forEach((note, j) => setMelodyNote(i, j, note)))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Control bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">调</span>
          <select
            value={keyRoot}
            onChange={e => setKeyRoot(Number(e.target.value))}
            className="bg-zinc-800 text-zinc-200 text-xs rounded-md px-2 py-1.5 border border-zinc-700 outline-none focus:border-amber-500"
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
              className={`px-2.5 py-2 rounded-md text-xs font-medium ${
                pattern === p.id
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {(['4/4', '3/4', '6/8', '2/4'] as const).map(ts => (
            <button
              key={ts}
              onClick={() => setTimeSig(ts)}
              className={`px-2 py-2 rounded-md text-xs font-mono font-medium ${
                timeSig === ts
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              {ts}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {([
            { d: 16 as const, label: '全', title: '全音符' },
            { d: 8  as const, label: '半', title: '二分音符' },
            { d: 4  as const, label: '♩', title: '四分音符' },
            { d: 2  as const, label: '♪', title: '八分音符' },
            { d: 1  as const, label: '♬', title: '十六分音符' },
          ]).map(({ d, label, title }) => (
            <button
              key={d}
              onClick={() => setNoteDuration(d)}
              title={title}
              className={`px-2 py-2 rounded-md text-xs font-medium ${
                noteDuration === d
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">BPM</span>
          <input
            type="number"
            min={40}
            max={200}
            value={bpm}
            onChange={e => setBpm(Math.max(40, Math.min(200, Number(e.target.value))))}
            className="w-14 bg-zinc-800 text-zinc-200 text-xs rounded-md px-2 py-1.5 border border-zinc-700 outline-none text-center focus:border-amber-500"
          />
        </div>
      </div>

      {/* Action row */}
      <div className="flex gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <button
          onClick={() => setPanel('ai')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-md bg-zinc-800 text-zinc-400 text-xs font-medium hover:text-zinc-200 hover:bg-zinc-700"
        >
          <IconWand className="w-3.5 h-3.5" />
          AI 创作
        </button>
        <button
          onClick={() => setPanel('save')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-md bg-zinc-800 text-zinc-400 text-xs font-medium hover:text-zinc-200 hover:bg-zinc-700"
        >
          <IconSave className="w-3.5 h-3.5" />
          保存
        </button>
        <button
          onClick={() => setPanel('library')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-md bg-zinc-800 text-zinc-400 text-xs font-medium hover:text-zinc-200 hover:bg-zinc-700"
        >
          <IconLibrary className="w-3.5 h-3.5" />
          曲库
          {savedList.length > 0 && (
            <span className="ml-0.5 text-amber-400">({savedList.length})</span>
          )}
        </button>
      </div>

      {/* Sequencer grid */}
      <div className="flex-1 overflow-y-auto py-4">
        <SequencerGrid
          state={state}
          onChordChange={setChordSlot}
          onMelodyChange={setMelodyNote}
          onAddBar={addBar}
        />

        {state.chords.every(c => c.root === null) && (
          <p className="text-center text-zinc-600 text-xs mt-8 px-8 leading-relaxed">
            点击格子选择和弦<br />
            点击下方小格添加旋律音<br />
            或使用 AI 创作功能一键生成
          </p>
        )}
      </div>

      {/* Play / Stop */}
      <div className="flex gap-2 px-4 py-3.5 bg-zinc-900 border-t border-zinc-800">
        <button
          onClick={isPlaying ? stop : play}
          className={`flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 ${
            isPlaying
              ? 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
              : 'bg-amber-500 text-zinc-950 hover:bg-amber-400'
          }`}
        >
          {isPlaying
            ? <><IconStop className="w-4 h-4" /> 停止</>
            : <><IconPlay className="w-4 h-4" /> 循环播放</>
          }
        </button>
        <button
          onClick={clearAll}
          className="px-3 py-3 rounded-xl bg-zinc-800 text-zinc-500 text-xs hover:bg-red-500/20 hover:text-red-400 border border-zinc-700 transition-colors"
          title="清空所有编曲"
        >
          清空
        </button>
        {state.chords.length > 1 && (
          <button
            onClick={removeLastBar}
            className="px-3 py-3 rounded-xl bg-zinc-800 text-zinc-500 text-xs hover:bg-zinc-700 hover:text-zinc-300 border border-zinc-700"
            title="删除最后一节"
          >
            −节
          </button>
        )}
      </div>

      {panel === 'ai' && (
        <AiPanel
          onGenerate={result => { applyComposition(result); setPanel(null) }}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'save' && (
        <SaveNameModal
          onSave={name => saveComposition(name, state)}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'library' && (
        <SavedList
          list={savedList}
          onLoad={item => { applyComposition(item); setPanel(null) }}
          onDelete={removeComposition}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  )
}
