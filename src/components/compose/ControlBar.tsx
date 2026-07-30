import { useState, useRef } from 'react'
import { encodeShareUrl } from '../../utils/shareUrl'
import { exportMidi } from '../../utils/midiExport'
import { downloadWav } from '../../utils/audioExport'
import { renderTab } from '../../utils/tabExport'
import { readMidiFile } from '../../utils/midiImport'
import { ROOTS } from '../../utils/dbUtils'
import { useChordDb } from '../../hooks/useChordDb'
import { IconShare, IconMetronome, IconMidi } from '../ui/icons'
import TabViewModal from './TabViewModal'
import type { SequencerState, TimeSig, ChordSlot, MelodyNote } from '../../types/audio'
import type { useMetronome } from '../../hooks/useMetronome'
import type { LoopRange } from '../../hooks/useSequencer'

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
  setCapo: (capo: number) => void
  transpose: (semitones: number) => void
  metronome: ReturnType<typeof useMetronome>
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  countIn: boolean
  onCountInChange: (on: boolean) => void
  loopRange: LoopRange | null
  onLoopRangeChange: (r: LoopRange | null) => void
  rampOn: boolean
  onRampChange: (on: boolean) => void
  onImportMidi: (r: { bpm: number; timeSig: TimeSig; chords: ChordSlot[]; melody: (MelodyNote | null)[][] }) => void
}

export default function ControlBar({
  state, setBpm, setPattern, setKeyRoot, setTimeSig, setNoteDuration, setCapo,
  transpose, metronome, canUndo, canRedo, onUndo, onRedo,
  countIn, onCountInChange, loopRange, onLoopRangeChange, rampOn, onRampChange, onImportMidi,
}: Props) {
  const { bpm, pattern, keyRoot, timeSig, noteDuration, capo } = state
  const [shareCopied, setShareCopied] = useState(false)
  const [tabText, setTabText] = useState<string | null>(null)
  const [wavBusy, setWavBusy] = useState(false)
  const { getChordEntry } = useChordDb()
  const fileRef = useRef<HTMLInputElement | null>(null)

  function positionOf(slot: ChordSlot) {
    if (!slot.root || !slot.suffix) return null
    return getChordEntry(slot.root, slot.suffix)?.positions[slot.positionIndex] ?? null
  }

  async function handleWav() {
    setWavBusy(true)
    // 让按钮先渲染出"导出中"，再跑同步的离线渲染
    await new Promise(r => setTimeout(r, 30))
    try {
      downloadWav({
        bpm: state.bpm, pattern: state.pattern, timeSig: state.timeSig, capo: state.capo,
        chords: state.chords, melody: state.melody, getPosition: positionOf,
      })
    } finally {
      setWavBusy(false)
    }
  }

  function handleTab() {
    setTabText(renderTab({
      pattern: state.pattern, timeSig: state.timeSig, capo: state.capo,
      chords: state.chords, melody: state.melody, getPosition: positionOf,
    }))
  }

  async function handleMidiFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const r = await readMidiFile(f)
    if (!r) { alert('无法解析该 MIDI 文件') ; return }
    onImportMidi(r)
  }

  // TAP 测速：连点按钮取平均间隔
  const tapsRef = useRef<number[]>([])
  function handleTap() {
    const now = performance.now()
    const taps = tapsRef.current
    if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0  // 停顿超 2 秒重新开始
    taps.push(now)
    if (taps.length > 6) taps.shift()
    if (taps.length >= 2) {
      const avg = (taps[taps.length - 1] - taps[0]) / (taps.length - 1)
      setBpm(Math.max(40, Math.min(200, Math.round(60000 / avg))))
    }
  }

  // 循环区间输入缓冲
  const totalBars = Math.max(1, state.chords.reduce((acc, c) => acc + 1 / (c.noteValue ?? 1), 0))
  function updateLoop(part: 'start' | 'end', v: number) {
    const cur = loopRange ?? { start: 1, end: Math.ceil(totalBars) }
    const next = { ...cur, [part]: Math.max(1, Math.min(64, Math.round(v) || 1)) }
    if (next.end < next.start) next.end = next.start
    onLoopRangeChange(next)
  }

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
    exportMidi({ bpm: state.bpm, timeSig: state.timeSig, chords: state.chords, melody: state.melody, capo: state.capo })
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

        {/* Capo */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">CAPO</span>
          <select
            value={capo}
            onChange={e => setCapo(Number(e.target.value))}
            aria-label="变调夹品位"
            className="bg-zinc-800 text-zinc-200 text-xs rounded-md px-2 py-1.5 border border-zinc-700 outline-none focus:border-amber-500"
          >
            {Array.from({ length: 8 }, (_, i) => (
              <option key={i} value={i}>{i === 0 ? '无' : `${i}品`}</option>
            ))}
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
          <button
            onClick={handleTap}
            title="连续点击测速"
            className="px-2 py-1.5 rounded-md bg-zinc-800 text-zinc-400 text-[10px] font-bold tracking-wider hover:bg-zinc-700 hover:text-amber-400 active:bg-amber-500 active:text-zinc-950"
          >TAP</button>
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
            onClick={() => fileRef.current?.click()}
            title="导入 MIDI 文件的旋律"
            className="px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-400 text-xs hover:text-zinc-200 hover:bg-zinc-700"
          >导入</button>
          <input
            ref={fileRef}
            type="file"
            accept=".mid,.midi,audio/midi"
            onChange={handleMidiFile}
            className="hidden"
            aria-hidden="true"
          />

          <button
            onClick={handleWav}
            disabled={wavBusy}
            title="导出为 WAV 音频"
            className="px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-400 text-xs hover:text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
          >{wavBusy ? '导出中…' : 'WAV'}</button>

          <button
            onClick={handleTab}
            title="查看六线谱"
            className="px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-400 text-xs hover:text-zinc-200 hover:bg-zinc-700"
          >六线谱</button>

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

      {/* ── 练习辅助行 ── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex-wrap">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">练习</span>

        <button
          onClick={() => onCountInChange(!countIn)}
          title="播放前先给一小节节拍器预备拍"
          className={`px-2.5 py-1 rounded-md text-xs font-medium ${
            countIn
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
          }`}
        >预备拍</button>

        <button
          onClick={() => onRampChange(!rampOn)}
          title="从目标速度的 70% 起步，每循环一遍提速 5%，直到目标 BPM"
          className={`px-2.5 py-1 rounded-md text-xs font-medium ${
            rampOn
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
          }`}
        >渐进加速</button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onLoopRangeChange(loopRange ? null : { start: 1, end: Math.ceil(totalBars) })}
            title="只循环指定的小节区间"
            className={`px-2.5 py-1 rounded-md text-xs font-medium ${
              loopRange
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
            }`}
          >区间循环</button>
          {loopRange && (
            <span className="flex items-center gap-1 text-xs text-zinc-400">
              <input
                type="number" min={1} max={64} value={loopRange.start}
                onChange={e => updateLoop('start', Number(e.target.value))}
                aria-label="循环起始小节"
                className="w-11 bg-zinc-800 text-zinc-200 text-xs rounded-md px-1 py-1 border border-zinc-700 outline-none text-center focus:border-amber-500"
              />
              –
              <input
                type="number" min={1} max={64} value={loopRange.end}
                onChange={e => updateLoop('end', Number(e.target.value))}
                aria-label="循环结束小节"
                className="w-11 bg-zinc-800 text-zinc-200 text-xs rounded-md px-1 py-1 border border-zinc-700 outline-none text-center focus:border-amber-500"
              />
              <span className="text-zinc-600">小节</span>
            </span>
          )}
        </div>
      </div>

      {tabText !== null && <TabViewModal text={tabText} onClose={() => setTabText(null)} />}
    </>
  )
}
