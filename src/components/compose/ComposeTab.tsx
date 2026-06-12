import { useState, useEffect } from 'react'
import { useSequencer } from '../../hooks/useSequencer'
import { useSavedCompositions } from '../../hooks/useSavedCompositions'
import { useAiCompose } from '../../hooks/useAiCompose'
import { useMetronome } from '../../hooks/useMetronome'
import { loadApiConfig } from './ApiConfigModal'
import { encodeShareUrl, decodeShareUrl } from '../../utils/shareUrl'
import { exportMidi } from '../../utils/midiExport'
import SequencerGrid from './SequencerGrid'
import AiPanel from './AiPanel'
import SaveNameModal from './SaveNameModal'
import SavedList from './SavedList'
import {
  IconPlay, IconStop, IconWand, IconSave, IconLibrary,
  IconShare, IconMetronome, IconMidi,
} from '../ui/icons'
import type { AiComposition } from '../../hooks/useAiCompose'
import type { SavedComposition } from '../../types/compose'
import type { SequencerState } from '../../types/audio'
import { ROOTS } from '../../utils/dbUtils'
import { setToneConfig } from '../../audio/toneConfig'

const PATTERNS: { id: SequencerState['pattern']; label: string }[] = [
  { id: '53231323', label: '民谣' },
  { id: 'x3231323', label: '切音' },
  { id: '3_12_3',   label: '古典' },
  { id: 'strum',    label: '扫弦' },
]

const TS_BEATS: Record<string, number> = { '4/4': 4, '3/4': 3, '6/8': 6, '2/4': 2 }

type Panel = 'ai' | 'save' | 'library' | null

export default function ComposeTab() {
  const {
    state, setChordSlot, setMelodyNote, setBpm, setPattern, setKeyRoot,
    setTimeSig, setNoteDuration, addBar, removeLastBar, clearAll, loadComposition, transpose, play, stop,
  } = useSequencer()
  const { list: savedList, save: saveComposition, remove: removeComposition, exportAll, importFrom } = useSavedCompositions()
  const { generate, isLoading: aiLoading, error: aiError, clearError: clearAiError } = useAiCompose()
  const metronome = useMetronome()

  const [panel,     setPanel]     = useState<Panel>(null)
  const [aiPrompt,  setAiPrompt]  = useState('')
  const [aiResult,  setAiResult]  = useState<AiComposition | null>(null)
  const [shareCopied, setShareCopied] = useState(false)

  const { isPlaying, bpm, pattern, keyRoot, timeSig, noteDuration } = state

  // Keep metronome BPM/time-sig in sync silently
  useEffect(() => { metronome.syncBpm(bpm) }, [bpm])
  useEffect(() => { metronome.syncBpb(TS_BEATS[timeSig] ?? 4) }, [timeSig])

  // Load composition from share URL on first mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const s = params.get('s')
    if (!s) return
    const decoded = decodeShareUrl(s)
    if (!decoded) return
    applyComposition(decoded as AiComposition)
    window.history.replaceState({}, '', window.location.pathname)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyComposition(src: AiComposition | SavedComposition) {
    loadComposition(src.chords, src.melody, {
      bpm:          src.bpm,
      pattern:      src.pattern,
      keyRoot:      src.keyRoot,
      timeSig:      src.timeSig,
      noteDuration: 'noteDuration' in src ? src.noteDuration : undefined,
    })
    if ('tone' in src && src.tone) setToneConfig(src.tone)
  }

  async function handleAiGenerate(targetBars?: number) {
    if (!aiPrompt.trim() || aiLoading) return
    const config = loadApiConfig()
    const r = await generate(aiPrompt, config, targetBars)
    if (r) setAiResult(r)
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
    <div className="flex flex-col h-full">
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
                noteDuration === d ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
              }`}
            >{label}</button>
          ))}
        </div>

        {/* BPM */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">BPM</span>
          <input
            type="number" min={40} max={200} value={bpm}
            onChange={e => setBpm(Math.max(40, Math.min(200, Number(e.target.value))))}
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

      {/* ── Action row (AI / Save / Library) ── */}
      <div className="flex gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <button
          onClick={() => setPanel('ai')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-md text-xs font-medium ${
            aiLoading
              ? 'bg-amber-500/15 text-amber-400 animate-pulse'
              : aiResult
              ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
              : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
          }`}
        >
          <IconWand className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
          {aiLoading ? '生成中...' : aiResult ? 'AI 结果' : 'AI 创作'}
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
          曲库{savedList.length > 0 && <span className="ml-0.5 text-amber-400">({savedList.length})</span>}
        </button>
      </div>

      {/* ── Sequencer grid ── */}
      <div className="flex-1 overflow-y-auto scrollbar-none py-4">
        <SequencerGrid
          state={state}
          onChordChange={setChordSlot}
          onMelodyChange={setMelodyNote}
          onAddBar={addBar}
        />
        {state.chords.every(c => c.root === null) && (
          <p className="text-center text-zinc-600 text-xs mt-8 px-8 leading-relaxed">
            {/* Mobile: line breaks; PC (md+): single line with dots */}
            <span className="md:hidden">
              点击格子选择和弦<br />
              点击下方小格添加旋律音<br />
              或使用 AI 创作功能一键生成
            </span>
            <span className="hidden md:inline">
              点击格子选择和弦 · 点击下方小格添加旋律音 · 或使用 AI 创作功能一键生成
            </span>
          </p>
        )}
      </div>

      {/* ── Play / Stop / Clear ── */}
      <div className="flex gap-2 px-4 py-3.5 bg-zinc-900 border-t border-zinc-800">
        <button
          onClick={isPlaying ? stop : play}
          className={`flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 ${
            isPlaying
              ? 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
              : 'bg-amber-500 text-zinc-950 hover:bg-amber-400'
          }`}
        >
          {isPlaying ? <><IconStop className="w-4 h-4" /> 停止</> : <><IconPlay className="w-4 h-4" /> 循环播放</>}
        </button>
        <button
          onClick={clearAll}
          className="px-3 py-3 rounded-xl bg-zinc-800 text-zinc-500 text-xs hover:bg-red-500/20 hover:text-red-400 border border-zinc-700 transition-colors"
          title="清空所有编曲"
        >清空</button>
        {state.chords.length > 1 && (
          <button
            onClick={removeLastBar}
            className="px-3 py-3 rounded-xl bg-zinc-800 text-zinc-500 text-xs hover:bg-zinc-700 hover:text-zinc-300 border border-zinc-700"
            title="删除最后一节"
          >−节</button>
        )}
      </div>

      {/* ── Panels ── */}
      {panel === 'ai' && (
        <AiPanel
          onGenerate={result => { applyComposition(result); setAiResult(null); setPanel(null) }}
          onClose={() => setPanel(null)}
          prompt={aiPrompt}
          onPromptChange={setAiPrompt}
          result={aiResult}
          onResultClear={() => setAiResult(null)}
          isLoading={aiLoading}
          error={aiError}
          onClearError={clearAiError}
          onTriggerGenerate={handleAiGenerate}
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
          onExport={exportAll}
          onImport={importFrom}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  )
}
