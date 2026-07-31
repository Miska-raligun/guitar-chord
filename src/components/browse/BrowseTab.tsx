import { useState, useEffect } from 'react'
import { useChordDb } from '../../hooks/useChordDb'
import { useArpeggio } from '../../hooks/useArpeggio'
import { onAppEvent, EV_VIEW_CHORD } from '../../utils/appBus'
import type { ChordRef } from '../../utils/appBus'
import ChordChangeTrainer from './ChordChangeTrainer'
import type { TrainerChord } from './ChordChangeTrainer'
import RootSelector from './RootSelector'
import SuffixSelector from './SuffixSelector'
import PositionSelector from './PositionSelector'
import ArpeggioPlayer from './ArpeggioPlayer'
import CustomPatternEditor from './CustomPatternEditor'
import ChordDiagram from '../chord/ChordDiagram'
import ChordLabel from '../chord/ChordLabel'
import type { ArpeggioPattern, CustomConfig, TimeSig, CustomStepKind } from '../../types/audio'

const DEFAULT_CUSTOM_STEPS: CustomStepKind[] = ['根', '3', '12', '3']
const DEFAULT_CUSTOM_TIMSIG: TimeSig = '4/4'

export default function BrowseTab() {
  const { keys, suffixes, getChordEntry } = useChordDb()
  const { arpeggioState, play, stop, updateCustomPattern } = useArpeggio()

  const [selectedRoot, setSelectedRoot] = useState(keys[0] ?? 'C')
  const [selectedSuffix, setSelectedSuffix] = useState(suffixes[0] ?? 'major')
  const [positionIndex, setPositionIndex] = useState(0)
  const [localBpm, setLocalBpm] = useState(80)
  const [localPattern, setLocalPattern] = useState<ArpeggioPattern>('53231323')
  const [customSteps, setCustomSteps] = useState<CustomStepKind[]>(DEFAULT_CUSTOM_STEPS)
  const [customTimeSig, setCustomTimeSig] = useState<TimeSig>(DEFAULT_CUSTOM_TIMSIG)

  // 和弦转换练习的选中列表提到这里，好让和弦区直接"加入练习"
  const [trainerList, setTrainerList] = useState<TrainerChord[]>([])
  const [trainerOpen, setTrainerOpen] = useState(false)

  const inTrainer = trainerList.some(c => c.root === selectedRoot && c.suffix === selectedSuffix)

  function toggleTrainerChord() {
    if (inTrainer) {
      setTrainerList(trainerList.filter(c => !(c.root === selectedRoot && c.suffix === selectedSuffix)))
      return
    }
    setTrainerList([...trainerList, { root: selectedRoot, suffix: selectedSuffix }])
    setTrainerOpen(true)   // 首次加入时把练习区展开，让用户看到
  }

  const entry = getChordEntry(selectedRoot, selectedSuffix)
  const positions = entry?.positions ?? []
  const safePositionIndex = Math.min(positionIndex, Math.max(0, positions.length - 1))
  const currentPosition = positions[safePositionIndex] ?? null

  const customConfig: CustomConfig = { steps: customSteps, timeSig: customTimeSig }

  // 和弦变化时重置把位（渲染期调整），停止试听放在 effect 里（副作用）
  const chordKey = `${selectedRoot}|${selectedSuffix}`
  const [lastChordKey, setLastChordKey] = useState(chordKey)
  if (lastChordKey !== chordKey) {
    setLastChordKey(chordKey)
    setPositionIndex(0)
  }
  useEffect(() => {
    stop()
  }, [selectedRoot, selectedSuffix, stop])

  // 识别页"查看指法"联动：跳转到指定和弦
  useEffect(() => onAppEvent<ChordRef>(EV_VIEW_CHORD, ({ root, suffix }) => {
    setSelectedRoot(root)
    setSelectedSuffix(suffix)
  }), [])

  // 播放中实时更新自定义节奏型
  useEffect(() => {
    if (arpeggioState.isPlaying && localPattern === 'custom') {
      updateCustomPattern(customConfig, localBpm)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customSteps, customTimeSig])

  function handlePlay() {
    if (!currentPosition) return
    play(currentPosition, localPattern, localBpm,
      localPattern === 'custom' ? customConfig : undefined)
  }

  function handlePatternChange(pattern: ArpeggioPattern) {
    setLocalPattern(pattern)
    if (arpeggioState.isPlaying && currentPosition) {
      play(currentPosition, pattern, localBpm,
        pattern === 'custom' ? customConfig : undefined)
    }
  }

  function handleBpmChange(bpm: number) {
    setLocalBpm(bpm)
    if (arpeggioState.isPlaying && currentPosition) {
      play(currentPosition, localPattern, bpm,
        localPattern === 'custom' ? customConfig : undefined)
    }
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-5">
      <div>
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">根音</div>
        <RootSelector selected={selectedRoot} onChange={setSelectedRoot} />
      </div>

      <div>
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">和弦类型</div>
        <SuffixSelector suffixes={suffixes} selected={selectedSuffix} onChange={setSelectedSuffix} />
      </div>

      {currentPosition ? (
        <>
          <div className="flex flex-col items-center gap-3 py-2">
            <ChordLabel root={selectedRoot} suffix={selectedSuffix} />
            <ChordDiagram
              position={currentPosition}
              activeString={arpeggioState.activeString}
              strumFlash={arpeggioState.isStrumBeat}
            />
            <PositionSelector
              total={positions.length}
              current={safePositionIndex}
              onChange={idx => { setPositionIndex(idx); stop() }}
            />

            <button
              onClick={toggleTrainerChord}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                inTrainer
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-amber-400 border border-transparent'
              }`}
            >
              {inTrainer ? `✓ 已在练习中（${trainerList.length}）` : '＋ 加入练习'}
            </button>
          </div>

          <div className="bg-zinc-800/50 rounded-xl p-4 space-y-4">
            <ArpeggioPlayer
              position={currentPosition}
              arpeggioState={{ ...arpeggioState, bpm: localBpm, pattern: localPattern }}
              onPlay={handlePlay}
              onStop={stop}
              onPatternChange={handlePatternChange}
              onBpmChange={handleBpmChange}
            />

            {/* 自定义编辑器：仅在选中 custom 时展开 */}
            {localPattern === 'custom' && (
              <div className="border-t border-zinc-700 pt-4">
                <CustomPatternEditor
                  steps={customSteps}
                  timeSig={customTimeSig}
                  onStepsChange={setCustomSteps}
                  onTimeSigChange={setCustomTimeSig}
                />
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-center text-zinc-600 py-8 text-sm">
          该和弦暂无指法数据
        </div>
      )}

      <div className="flex justify-center">
        <ChordChangeTrainer
          list={trainerList}
          onListChange={setTrainerList}
          open={trainerOpen}
          onOpenChange={setTrainerOpen}
        />
      </div>
    </div>
  )
}
