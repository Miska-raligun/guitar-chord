import { useSequencer } from '../../hooks/useSequencer'
import SequencerGrid from './SequencerGrid'
import { ROOTS } from '../../utils/dbUtils'
import type { SequencerState } from '../../types/audio'

const PATTERNS: { id: SequencerState['pattern']; label: string }[] = [
  { id: '53231323', label: '民谣' },
  { id: 'x3231323', label: '闷音' },
  { id: '3_12_3',   label: '古典' },
  { id: 'strum',    label: '扫弦' },
]

export default function ComposeTab() {
  const { state, setChordSlot, setMelodyNote, setBpm, setPattern, setKeyRoot, play, stop } = useSequencer()
  const { isPlaying, bpm, pattern, keyRoot } = state

  return (
    <div className="flex flex-col h-full">
      {/* Control bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex-wrap">
        {/* Key root selector */}
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

        {/* Pattern selector */}
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

        {/* BPM */}
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

      {/* Sequencer grid */}
      <div className="flex-1 overflow-y-auto py-4">
        <SequencerGrid
          state={state}
          onChordChange={setChordSlot}
          onMelodyChange={setMelodyNote}
        />

        {/* Hint */}
        {state.chords.every(c => c.root === null) && (
          <p className="text-center text-zinc-600 text-xs mt-6 px-8">
            点击格子选择和弦，点击下方小格添加旋律音
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
    </div>
  )
}
