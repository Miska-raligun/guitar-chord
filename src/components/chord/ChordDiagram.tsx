import Chord from '@techies23/react-chords'
import { GUITAR_INSTRUMENT } from '../../types/chord'
import type { ChordPosition } from '../../types/chord'

interface Props {
  position: ChordPosition
  activeString?: number | null
  lite?: boolean
}

// String positions in the SVG (approximate x coords for each of 6 strings)
// react-chords renders 6 strings left-to-right (string 0 = low E on left)
const STRING_X_OFFSETS = [0.135, 0.271, 0.407, 0.543, 0.679, 0.815]

export default function ChordDiagram({ position, activeString, lite = false }: Props) {
  const size = lite ? 120 : 180
  const svgSize = size

  return (
    <div className="relative inline-block" style={{ width: svgSize, height: svgSize }}>
      <Chord
        chord={position}
        instrument={GUITAR_INSTRUMENT}
        lite={lite}
      />
      {activeString !== null && activeString !== undefined && (
        <div
          className="absolute top-0 pointer-events-none"
          style={{
            left: `${STRING_X_OFFSETS[activeString] * 100}%`,
            transform: 'translateX(-50%)',
            top: '8%',
          }}
        >
          <div className="w-4 h-4 rounded-full bg-amber-400 opacity-80 animate-ping" />
        </div>
      )}
    </div>
  )
}
