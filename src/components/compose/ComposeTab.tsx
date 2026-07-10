import { useState, useEffect, useRef } from 'react'
import { useSequencer } from '../../hooks/useSequencer'
import { useSavedCompositions } from '../../hooks/useSavedCompositions'
import { useAiCompose } from '../../hooks/useAiCompose'
import { useMetronome } from '../../hooks/useMetronome'
import { useDraftAutosave, loadDraft } from '../../hooks/useDraft'
import { loadApiConfig } from './ApiConfigModal'
import { decodeShareUrl } from '../../utils/shareUrl'
import { onAppEvent, EV_ADD_TO_COMPOSE } from '../../utils/appBus'
import type { ChordRef } from '../../utils/appBus'
import SequencerGrid from './SequencerGrid'
import AiPanel from './AiPanel'
import SaveNameModal from './SaveNameModal'
import SavedList from './SavedList'
import ControlBar, { TS_BEATS } from './ControlBar'
import { IconPlay, IconStop, IconWand, IconSave, IconLibrary } from '../ui/icons'
import type { AiComposition, ContinueFromState } from '../../hooks/useAiCompose'
import type { SavedComposition } from '../../types/compose'
import { setToneConfig, getToneConfig } from '../../audio/toneConfig'

type Panel = 'ai' | 'save' | 'library' | null

export default function ComposeTab() {
  const {
    state, canUndo, canRedo, undo, redo,
    setChordSlot, setMelodyNote, setBpm, setPattern, setKeyRoot,
    setTimeSig, setNoteDuration, addBar, appendChordSlot, addStrumPattern, fillBarAt, setBarSubdivision,
    removeLastBar, clearAll, loadComposition, transpose, play, stop,
  } = useSequencer()
  const { list: savedList, save: saveComposition, remove: removeComposition, exportAll, importFrom } = useSavedCompositions()
  const { generate, isLoading: aiLoading, progress: aiProgress, error: aiError, clearError: clearAiError } = useAiCompose()
  const metronome = useMetronome()

  const [panel,     setPanel]     = useState<Panel>(null)
  const [aiPrompt,  setAiPrompt]  = useState('')
  const [aiResult,  setAiResult]  = useState<AiComposition | null>(null)
  const [aiMode,    setAiMode]    = useState<'new' | 'append' | 'fill'>('new')
  const [draftReady, setDraftReady] = useState(false)

  const hasChords = state.chords.some(c => c.root !== null)
  const hasExistingContent = hasChords
    || state.melody.some(row => row.some(n => n !== null))

  function openAiPanel() {
    // Default to 续写 when there's already something composed
    if (hasExistingContent) setAiMode('append')
    else setAiMode('new')
    setPanel('ai')
  }

  const { isPlaying, bpm, timeSig } = state

  // Keep metronome BPM/time-sig in sync silently
  useEffect(() => { metronome.syncBpm(bpm) }, [bpm])
  useEffect(() => { metronome.syncBpb(TS_BEATS[timeSig] ?? 4) }, [timeSig])

  // On first mount: a share URL wins; otherwise restore the autosaved draft.
  // Only after that does autosaving start (so the initial empty state never
  // overwrites an existing draft).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const s = params.get('s')
    const decoded = s ? decodeShareUrl(s) : null
    if (decoded) {
      applyComposition(decoded as AiComposition)
    } else {
      const draft = loadDraft()
      if (draft) {
        loadComposition(draft.chords, draft.melody, {
          bpm: draft.bpm, pattern: draft.pattern, keyRoot: draft.keyRoot,
          timeSig: draft.timeSig, noteDuration: draft.noteDuration,
        })
      }
    }
    setDraftReady(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useDraftAutosave(state, draftReady)

  // 识别页"加入编曲"入口
  useEffect(() => onAppEvent<ChordRef>(EV_ADD_TO_COMPOSE, ({ root, suffix }) => {
    appendChordSlot(root, suffix)
  }), [appendChordSlot])

  // Ctrl/Cmd+Z 撤销、Ctrl+Shift+Z / Ctrl+Y 重做（输入框内不拦截）
  const undoRef = useRef(undo)
  const redoRef = useRef(redo)
  undoRef.current = undo
  redoRef.current = redo
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); undoRef.current() }
      else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); redoRef.current() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function applyComposition(src: AiComposition | SavedComposition, mode: 'new' | 'append' | 'fill' = 'new') {
    if (mode === 'append') {
      const newChords = [...state.chords, ...src.chords]
      const newMelody = [...state.melody, ...src.melody]
      loadComposition(newChords, newMelody, {
        bpm:     src.bpm,
        pattern: src.pattern,
        keyRoot: src.keyRoot,
        timeSig: src.timeSig,
      })
      if ('tone' in src && src.tone) setToneConfig(src.tone)
    } else if (mode === 'fill') {
      // Keep the existing chords / settings untouched; overlay the generated
      // melody onto the matching bars (by index).
      const newMelody = state.chords.map((_, i) =>
        src.melody[i] ?? state.melody[i] ?? Array(16).fill(null)
      )
      loadComposition(state.chords, newMelody)
    } else {
      loadComposition(src.chords, src.melody, {
        bpm:          src.bpm,
        pattern:      src.pattern,
        keyRoot:      src.keyRoot,
        timeSig:      src.timeSig,
        noteDuration: 'noteDuration' in src ? src.noteDuration : undefined,
      })
      if ('tone' in src && src.tone) setToneConfig(src.tone)
    }
  }

  async function handleAiGenerate(targetBars?: number) {
    if (!aiPrompt.trim() || aiLoading) return
    const config = loadApiConfig()
    const { mode, effect } = getToneConfig()
    const continueFrom: ContinueFromState | undefined = aiMode !== 'new' ? {
      chords:  state.chords,
      melody:  state.melody,
      bpm:     state.bpm,
      timeSig: state.timeSig,
      pattern: state.pattern,
      keyRoot: state.keyRoot,
      tone:    { mode, effect },
      fillMelody: aiMode === 'fill',
    } : undefined
    const r = await generate(aiPrompt, config, targetBars, continueFrom)
    if (r) setAiResult(r)
  }

  return (
    <div className="flex flex-col h-full">
      <ControlBar
        state={state}
        setBpm={setBpm}
        setPattern={setPattern}
        setKeyRoot={setKeyRoot}
        setTimeSig={setTimeSig}
        setNoteDuration={setNoteDuration}
        transpose={transpose}
        metronome={metronome}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
      />

      {/* ── Action row (AI / Save / Library) ── */}
      <div className="flex gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <button
          onClick={openAiPanel}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-md text-xs font-medium ${
            aiLoading
              ? 'bg-amber-500/15 text-amber-400 animate-pulse'
              : aiResult
              ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
              : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
          }`}
        >
          <IconWand className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
          {aiLoading ? (aiProgress || '生成中...') : aiResult ? 'AI 结果' : 'AI 创作'}
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
          onAddStrumPattern={addStrumPattern}
          onFillBarAt={fillBarAt}
          onSetBarSubdivision={setBarSubdivision}
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
          title="清空所有编曲（可撤销）"
        >清空</button>
        {state.melody.length > 1 && (
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
          onGenerate={(result) => { applyComposition(result, aiMode); setAiResult(null); setPanel(null) }}
          onClose={() => setPanel(null)}
          prompt={aiPrompt}
          onPromptChange={setAiPrompt}
          result={aiResult}
          onResultClear={() => setAiResult(null)}
          isLoading={aiLoading}
          progress={aiProgress}
          error={aiError}
          onClearError={clearAiError}
          onTriggerGenerate={handleAiGenerate}
          hasExistingContent={hasExistingContent}
          hasChords={hasChords}
          aiMode={aiMode}
          onAiModeChange={setAiMode}
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
