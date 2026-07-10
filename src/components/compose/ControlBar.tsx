import { useState } from 'react'
import { encodeShareUrl } from '../../utils/shareUrl'
import { exportMidi } from '../../utils/midiExport'
import { ROOTS } from '../../utils/dbUtils'
import { IconShare, IconMetronome, IconMidi } from '../ui/icons'
import type { SequencerState, TimeSig } from '../../types/audio'
import type { useMetronome } from '../../hooks/useMetronome'

const PATTERNS: { id: SequencerState['pattern']; label: string }[] = [
  { id: '53231323', label: '民谣' },
  { id: 'x3231323', label: '切音' },
  { id: '3_12_3',   label: '古典' },
  { id: 'strum',    label: '扫弦' },
]

export const TS_BEATS: Record<string, number> = { '4/4': 4, '3/4': 3, '6/8': 6, '2/4': 2 }

const NOTE_DURATIONS = [
  { d: 16 as const, label: '全', title: '全音符' },
  { d: 8  as const, label: '半', title: '二分音符' },
  { d: 4  as const, label: '♩', title: '四分音符' },
  { d: 2  as const, label: '♪', title: '八分音符' },
  { d: 1  as const, label: '♬', title: '十六分音符' },
]

interface Props {
  state: SequencerState
  setBpm: (bpm: number) => void
  setPattern: (p: SequencerState['pattern']) => void
  setKeyRoot: (k: number) => void
  setTimeSig: (ts: TimeSig) => void
  setNoteDuration: (d: SequencerState['noteDuration']) => void
  transpose: (semitones: number) => void
  metronome: ReturnType<typeof useMetronome>
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}

export default function ControlBar({
  state, setBpm, setPattern, setKeyRoot, setTimeSig, setNoteDuration,
  transpose, metronome, canUndo, canRedo, onUndo, onRedo,
}: Props) {
  const { bpm, pattern, keyRoot, timeSig, noteDuration } = state
  const [shareCopied, setShareCopied] = useState(false)

  // Local text buffer for the BPM input — lets the user type freely (e.g. clear
  // the field, type "80") without each keystroke being clamped back into state.
  // 外部 bpm 变化时同步缓冲（渲染期调整，避免 effect 级联渲染）。
  const [bpmInput, setBpmInput] = useState(String(bpm))
  const [lastBpm, setLastBpm] = useState(bpm)
  if (lastBpm !== bpm) {
    setLastBpm(bpm)
    setBpmInput(String(bpm))
  }

  function commitBpm() {
    const n = Math.max(40, Math.min(200, Math.round(Number(bpmInput)) || bpm))
    setBpm(n)
    setBpmInput(String(n))
  }

  function handleShare() {
    const url = encodeShareUrl(state)
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    })
  }

  function handleMidi() {
    exportMidi({ bpm: state.bpm, timeSig: state.timeSig, chords: state.chords, melody: state.melody })
  }

  return (
    <>
      {/* ── Control bar ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 flex-wrap">
        {/* Key */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">调</span>
          <select
            value={keyRoot}
            onChange={e => setKeyRoot(Number(e.target.value))}
            className="bg-zinc-800 text-zinc-200 text-xs rounded-md px-2 py-1.5 border border-zinc-700 outline-none focus:border-amber-500"
          >
            {ROOTS.map((r, i) => <option key={r} value={i}>{r}</option>)}
          </select>
        </div>

        {/* Pattern */}
        <div className="flex items-center gap-1">
          {PATTERNS.map(p => (
            <button
              key={p.id}
              onClick={() => setPattern(p.id)}
              className={`px-2.5 py-2 rounded-md text-xs font-medium ${
                pattern === p.id ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
              }`}
            >{p.label}</button>
          ))}
        </div>

        {/* Time signature */}
        <div className="flex items-center gap-1">
          {(['4/4', '3/4', '6/8', '2/4'] as const).map(ts => (
            <button
              key={ts}
              onClick={() => setTimeSig(ts)}
              className={`px-2 py-2 rounded-md text-xs font-mono font-medium ${
                timeSig === ts ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
              }`}
            >{ts}</button>
          ))}
        </div>

        {/* Note duration */}
        <div className="flex items-center gap-1">
          {NOTE_DURATIONS.map(({ d, label, title }) => (
            <button
              key={d}
              onClick={() => setNoteDuration(d)}
              title={title}
              className={`px-2 py-2 rounded-md text-xs font-medium ${
                noteDuration === d ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
              }`}
            >{label}</button>
          ))}
        </div>

        {/* BPM */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">BPM</span>
          <input
            type="number" min={40} max={200} value={bpmInput}
            onChange={e => setBpmInput(e.target.value)}
            onBlur={commitBpm}
            onKeyDown={e => { if (e.key === 'Enter') commitBpm() }}
            className="w-14 bg-zinc-800 text-zinc-200 text-xs rounded-md px-2 py-1.5 border border-zinc-700 outline-none text-center focus:border-amber-500"
          />
        </div>
      </div>

      {/* ── Transpose + Tools ──
           Mobile: two stacked rows
           PC (md+): single row, tools pushed to the right            */}
      <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        {/* Transpose */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mr-0.5">移调</span>
          {[-5, -4, -3, -2, -1, +1, +2, +3, +4, +5].map(n => (
            <button
              key={n}
              onClick={() => transpose(n)}
              title={`移调 ${n > 0 ? '+' : ''}${n} 半音`}
              className="w-6 h-6 flex items-center justify-center rounded text-[10px] font-mono bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            >{n > 0 ? `+${n}` : n}</button>
          ))}
        </div>

        {/* Tools */}
        <div className="flex items-center gap-1.5 md:ml-auto">
          {/* Undo / Redo */}
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="撤销 (Ctrl+Z)"
            className="px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-400 text-xs hover:text-zinc-200 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 disabled:hover:text-zinc-400"
          >
            ↩ 撤销
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="重做 (Ctrl+Shift+Z)"
            className="px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-400 text-xs hover:text-zinc-200 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 disabled:hover:text-zinc-400"
          >
            ↪ 重做
          </button>

          <button
            onClick={() => metronome.toggle(bpm, TS_BEATS[timeSig] ?? 4)}
            title="节拍器"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${
              metronome.isRunning
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            <IconMetronome className={`w-3.5 h-3.5 ${metronome.isRunning ? 'animate-pulse' : ''}`} />
            <span>节拍器</span>
            {metronome.isRunning && (
              <span className="flex gap-[3px] ml-0.5">
                {Array.from({ length: metronome.beatsPerBar }, (_, i) => (
                  <span
                    key={i}
                    className={`inline-block w-1.5 h-1.5 rounded-full transition-colors ${
                      i === metronome.currentBeat ? 'bg-amber-400' : 'bg-zinc-600'
                    }`}
                  />
                ))}
              </span>
            )}
          </button>

          <button
            onClick={handleMidi}
            title="导出 MIDI"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-400 text-xs hover:text-zinc-200 hover:bg-zinc-700"
          >
            <IconMidi className="w-3.5 h-3.5" />
            MIDI
          </button>

          <button
            onClick={handleShare}
            title="复制分享链接"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${
              shareCopied
                ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            <IconShare className="w-3.5 h-3.5" />
            {shareCopied ? '已复制！' : '分享'}
          </button>
        </div>
      </div>
    </>
  )
}
