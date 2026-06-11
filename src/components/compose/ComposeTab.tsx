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
  const { state, setChordSlot, setMelodyNote, setBpm, setPattern, setKeyRoot, setTimeSig, setNoteDuration, addBar, removeLastBar, play, stop } = useSequencer()
  const { list: savedList, save: saveComposition, remove: removeComposition } = useSavedCompositions()
  const [panel, setPanel] = useState<Panel>(null)
  const { isPlaying, bpm, pattern, keyRoot, timeSig, noteDuration } = state

  function applyComposition(src: AiComposition | SavedComposition) {
    stop()
    setBpm(src.bpm)
    setPattern(src.pattern)
    setKeyRoot(src.keyRoot)
    if ('timeSig' in src && src.timeSig) setTimeSig(src.timeSig)
    if ('noteDuration' in src && src.noteDuration) setNoteDuration(src.noteDuration)
    src.chords.forEach((slot, i) => setChordSlot(i, slot))
    src.melody.forEach((bar, i) => bar.forEach((note, j) => setMelodyNote(i, j, note)))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Control bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white/70 backdrop-blur-sm border-b border-amber-200/50 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">调</span>
          <select
            value={keyRoot}
            onChange={e => setKeyRoot(Number(e.target.value))}
            className="bg-white text-stone-700 text-xs rounded-md px-2 py-1.5 border border-amber-200 outline-none focus:border-amber-400"
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
                  ? 'bg-amber-500 text-stone-50'
                  : 'bg-amber-100 text-stone-600 hover:text-stone-800 hover:bg-amber-200'
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
                  ? 'bg-amber-500 text-stone-50'
                  : 'bg-amber-100 text-stone-600 hover:text-stone-800 hover:bg-amber-200'
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
                  ? 'bg-amber-500 text-stone-50'
                  : 'bg-amber-100 text-stone-600 hover:text-stone-800 hover:bg-amber-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">BPM</span>
          <input
            type="number"
            min={40}
            max={200}
            value={bpm}
            onChange={e => setBpm(Math.max(40, Math.min(200, Number(e.target.value))))}
            className="w-14 bg-white text-stone-700 text-xs rounded-md px-2 py-1.5 border border-amber-200 outline-none text-center focus:border-amber-400"
          />
        </div>
      </div>

      {/* Action row */}
      <div className="flex gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm border-b border-amber-200/40">
        <button
          onClick={() => setPanel('ai')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-md bg-amber-100 text-stone-600 text-xs font-medium hover:text-stone-800 hover:bg-amber-200"
        >
          <IconWand className="w-3.5 h-3.5" />
          AI 创作
        </button>
        <button
          onClick={() => setPanel('save')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-md bg-amber-100 text-stone-600 text-xs font-medium hover:text-stone-800 hover:bg-amber-200"
        >
          <IconSave className="w-3.5 h-3.5" />
          保存
        </button>
        <button
          onClick={() => setPanel('library')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-md bg-amber-100 text-stone-600 text-xs font-medium hover:text-stone-800 hover:bg-amber-200"
        >
          <IconLibrary className="w-3.5 h-3.5" />
          曲库
          {savedList.length > 0 && (
            <span className="ml-0.5 text-amber-600">({savedList.length})</span>
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
          <p className="text-center text-stone-400 text-xs mt-8 px-8 leading-relaxed">
            点击格子选择和弦<br />
            点击下方小格添加旋律音<br />
            或使用 AI 创作功能一键生成
          </p>
        )}
      </div>

      {/* Play / Stop */}
      <div className="flex gap-2 px-4 py-3.5 bg-white/70 backdrop-blur-sm border-t border-amber-200/50">
        <button
          onClick={isPlaying ? stop : play}
          className={`flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 ${
            isPlaying
              ? 'bg-amber-100 text-stone-600 border border-amber-200 hover:bg-amber-200'
              : 'bg-amber-500 text-stone-50 hover:bg-amber-600'
          }`}
        >
          {isPlaying
            ? <><IconStop className="w-4 h-4" /> 停止</>
            : <><IconPlay className="w-4 h-4" /> 循环播放</>
          }
        </button>
        {state.chords.length > 1 && (
          <button
            onClick={removeLastBar}
            className="px-3 py-3 rounded-xl bg-amber-100 text-stone-500 text-xs hover:bg-amber-200 hover:text-stone-700 border border-amber-200"
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
