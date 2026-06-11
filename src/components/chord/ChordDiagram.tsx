import Chord from '@techies23/react-chords'
import { GUITAR_INSTRUMENT } from '../../types/chord'
import type { ChordPosition } from '../../types/chord'

interface Props {
  position: ChordPosition
  activeString?: number | number[] | null
  strumFlash?: boolean
  lite?: boolean
}

const STRING_X_OFFSETS = [0.135, 0.271, 0.407, 0.543, 0.679, 0.815]

export default function ChordDiagram({ position, activeString, strumFlash, lite = false }: Props) {
  const size = lite ? 120 : 180

  // 统一为数组，空数组 = 无高亮
  const activeStrings: number[] =
    activeString === null || activeString === undefined
      ? []
      : Array.isArray(activeString)
      ? activeString
      : [activeString]

  return (
    <div
      className={`relative inline-block rounded-lg transition-all duration-75 ${
        strumFlash ? 'ring-2 ring-amber-500 ring-offset-1 ring-offset-amber-50' : ''
      }`}
      style={{ width: size, height: size }}
    >
      <Chord chord={position} instrument={GUITAR_INSTRUMENT} lite={lite} />

      {!strumFlash && activeStrings.map(si => (
        <div
          key={si}
          className="absolute pointer-events-none"
          style={{
            left: `${STRING_X_OFFSETS[si] * 100}%`,
            transform: 'translateX(-50%)',
            top: '6%',
          }}
        >
          <div className="w-3 h-3 rounded-full bg-amber-400 opacity-90 animate-ping" />
        </div>
      ))}
    </div>
  )
}
