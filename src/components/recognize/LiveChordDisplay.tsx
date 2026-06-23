import type { ChordMatch } from '../../types/audio'
import ChordDiagram from '../chord/ChordDiagram'
import ChordLabel from '../chord/ChordLabel'
import PositionSelector from '../browse/PositionSelector'

interface Props {
  match: ChordMatch | null
  positionIndex: number
  onPositionIndexChange: (index: number) => void
}

export default function LiveChordDisplay({ match, positionIndex, onPositionIndexChange }: Props) {
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

  return (
    <div className="flex flex-col items-center gap-4">
      <ChordLabel root={match.root} suffix={match.suffix} confidence={match.confidence} />
      {currentPosition ? (
        <>
          <ChordDiagram position={currentPosition} />
          <PositionSelector total={positions.length} current={safeIndex} onChange={onPositionIndexChange} />
        </>
      ) : (
        <div className="text-zinc-500 text-sm">无指法图数据</div>
      )}
    </div>
  )
}
