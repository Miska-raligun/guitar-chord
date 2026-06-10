import type { ChordMatch } from '../../types/audio'
import ChordDiagram from '../chord/ChordDiagram'
import ChordLabel from '../chord/ChordLabel'

interface Props {
  match: ChordMatch | null
}

export default function LiveChordDisplay({ match }: Props) {
  if (!match) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-zinc-600">
        <div className="text-4xl mb-2">🎸</div>
        <div className="text-sm">弹奏吉他和弦以识别...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <ChordLabel root={match.root} suffix={match.suffix} confidence={match.confidence} />
      {match.position ? (
        <ChordDiagram position={match.position} />
      ) : (
        <div className="text-zinc-500 text-sm">无指法图数据</div>
      )}
    </div>
  )
}
