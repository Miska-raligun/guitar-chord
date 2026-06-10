import { useState, useEffect } from 'react'
import { useChordDb } from '../../hooks/useChordDb'
import { useArpeggio } from '../../hooks/useArpeggio'
import RootSelector from './RootSelector'
import SuffixSelector from './SuffixSelector'
import PositionSelector from './PositionSelector'
import ArpeggioPlayer from './ArpeggioPlayer'
import ChordDiagram from '../chord/ChordDiagram'
import ChordLabel from '../chord/ChordLabel'
import type { ArpeggioPattern } from '../../types/audio'

export default function BrowseTab() {
  const { keys, suffixes, getChordEntry } = useChordDb()
  const { arpeggioState, play, stop } = useArpeggio()

  const [selectedRoot, setSelectedRoot] = useState(keys[0] ?? 'C')
  const [selectedSuffix, setSelectedSuffix] = useState(suffixes[0] ?? 'major')
  const [positionIndex, setPositionIndex] = useState(0)
  const [localBpm, setLocalBpm] = useState(80)
  const [localPattern, setLocalPattern] = useState<ArpeggioPattern>('53231323')


  const entry = getChordEntry(selectedRoot, selectedSuffix)
  const positions = entry?.positions ?? []
  const currentPosition = positions[positionIndex] ?? null

  useEffect(() => {
    setPositionIndex(0)
    stop()
  }, [selectedRoot, selectedSuffix, stop])

  function handlePlay() {
    if (!currentPosition) return
    play(currentPosition, localPattern, localBpm)
  }

  function handlePatternChange(pattern: ArpeggioPattern) {
    setLocalPattern(pattern)
    if (arpeggioState.isPlaying && currentPosition) {
      play(currentPosition, pattern, localBpm)
    }
  }

  function handleBpmChange(bpm: number) {
    setLocalBpm(bpm)
    if (arpeggioState.isPlaying && currentPosition) {
      play(currentPosition, localPattern, bpm)
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
        <SuffixSelector
          suffixes={suffixes}
          selected={selectedSuffix}
          onChange={setSelectedSuffix}
        />
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

          <div className="bg-zinc-800/50 rounded-xl p-4">
            <ArpeggioPlayer
              position={currentPosition}
              arpeggioState={{ ...arpeggioState, bpm: localBpm, pattern: localPattern }}
              onPlay={handlePlay}
              onStop={stop}
              onPatternChange={handlePatternChange}
              onBpmChange={handleBpmChange}
            />
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
