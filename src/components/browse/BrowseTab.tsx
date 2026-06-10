import { useState, useEffect } from 'react'
import { useChordDb } from '../../hooks/useChordDb'
import { useArpeggio } from '../../hooks/useArpeggio'
import RootSelector from './RootSelector'
import SuffixSelector from './SuffixSelector'
import PositionSelector from './PositionSelector'
import ArpeggioPlayer from './ArpeggioPlayer'
import CustomPatternEditor from './CustomPatternEditor'
import ChordDiagram from '../chord/ChordDiagram'
import ChordLabel from '../chord/ChordLabel'
import type { ArpeggioPattern, CustomConfig, CustomDuration, CustomStepKind } from '../../types/audio'

const DEFAULT_CUSTOM_STEPS: CustomStepKind[] = ['根', '3', '12', '3']
const DEFAULT_CUSTOM_DURATION: CustomDuration = 'quarter'

export default function BrowseTab() {
  const { keys, suffixes, getChordEntry } = useChordDb()
  const { arpeggioState, play, stop, updateCustomPattern } = useArpeggio()

  const [selectedRoot, setSelectedRoot] = useState(keys[0] ?? 'C')
  const [selectedSuffix, setSelectedSuffix] = useState(suffixes[0] ?? 'major')
  const [positionIndex, setPositionIndex] = useState(0)
  const [localBpm, setLocalBpm] = useState(80)
  const [localPattern, setLocalPattern] = useState<ArpeggioPattern>('53231323')
  const [customSteps, setCustomSteps] = useState<CustomStepKind[]>(DEFAULT_CUSTOM_STEPS)
  const [customDuration, setCustomDuration] = useState<CustomDuration>(DEFAULT_CUSTOM_DURATION)

  const entry = getChordEntry(selectedRoot, selectedSuffix)
  const positions = entry?.positions ?? []
  const currentPosition = positions[positionIndex] ?? null

  const customConfig: CustomConfig = { steps: customSteps, duration: customDuration }

  useEffect(() => {
    setPositionIndex(0)
    stop()
  }, [selectedRoot, selectedSuffix, stop])

  // 播放中实时更新自定义节奏型
  useEffect(() => {
    if (arpeggioState.isPlaying && localPattern === 'custom') {
      updateCustomPattern(customConfig, localBpm)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customSteps, customDuration])

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
              current={positionIndex}
              onChange={idx => { setPositionIndex(idx); stop() }}
            />
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
                  duration={customDuration}
                  onStepsChange={setCustomSteps}
                  onDurationChange={setCustomDuration}
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
    </div>
  )
}
