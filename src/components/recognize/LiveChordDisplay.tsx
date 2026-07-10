import { useState } from 'react'
import type { ChordMatch } from '../../types/audio'
import ChordDiagram from '../chord/ChordDiagram'
import ChordLabel from '../chord/ChordLabel'
import PositionSelector from '../browse/PositionSelector'
import { viewChordInBrowse, addChordToCompose } from '../../utils/appBus'

interface Props {
  match: ChordMatch | null
  positionIndex: number
  onPositionIndexChange: (index: number) => void
}

export default function LiveChordDisplay({ match, positionIndex, onPositionIndexChange }: Props) {
  const [added, setAdded] = useState(false)

  if (!match) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-zinc-600">
        <div className="text-4xl mb-2">🎸</div>
        <div className="text-sm">弹奏吉他和弦以识别...</div>
      </div>
    )
  }

  const positions = match.positions
  const safeIndex = Math.min(positionIndex, Math.max(0, positions.length - 1))
  const currentPosition = positions[safeIndex] ?? null

  function handleAddToCompose() {
    if (!match) return
    addChordToCompose({ root: match.root, suffix: match.suffix })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <ChordLabel root={match.root} suffix={match.suffix} confidence={match.confidence} />
      {currentPosition ? (
        <>
          <ChordDiagram position={currentPosition} />
          <PositionSelector total={positions.length} current={safeIndex} onChange={onPositionIndexChange} />
          <div className="flex gap-2">
            <button
              onClick={() => viewChordInBrowse({ root: match.root, suffix: match.suffix })}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700 hover:text-amber-400"
            >
              查看指法
            </button>
            <button
              onClick={handleAddToCompose}
              className={`px-3 py-1.5 rounded-lg text-xs ${
                added
                  ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-amber-400'
              }`}
            >
              {added ? '✓ 已加入' : '加入编曲'}
            </button>
          </div>
        </>
      ) : (
        <div className="text-zinc-500 text-sm">无指法图数据</div>
      )}
    </div>
  )
}
