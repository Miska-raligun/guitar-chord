import type { MelodyNote } from '../../types/audio'
import { pluckStringAt } from '../../audio/karplusStrong'
import audioEngine from '../../audio/AudioEngine'

// Standard tuning (low E → high e), index 0 = low E
const STRINGS = [
  { label: '⑥', name: 'E', openSemitone: 4,  freq: 82.41  },
  { label: '⑤', name: 'A', openSemitone: 9,  freq: 110.0  },
  { label: '④', name: 'D', openSemitone: 2,  freq: 146.83 },
  { label: '③', name: 'G', openSemitone: 7,  freq: 196.0  },
  { label: '②', name: 'B', openSemitone: 11, freq: 246.94 },
  { label: '①', name: 'e', openSemitone: 4,  freq: 329.63 },
]

const SOLFEGE_SHORT = ['1','♯1','2','♯2','3','4','♯4','5','♯5','6','♯6','7']
const FRET_COUNT = 13  // frets 0–12

const SINGLE_DOTS = new Set([3, 5, 7, 9])
const DOUBLE_DOTS = new Set([12])

interface Props {
  keyRoot: number
  noteDuration: number
  selected: MelodyNote | null
  onSelect: (note: MelodyNote) => void
}

export default function FretboardNotePicker({ keyRoot, noteDuration, selected, onSelect }: Props) {
  function handlePick(stringIdx: number, fret: number) {
    const str = STRINGS[stringIdx]
    const semitone = (str.openSemitone + fret) % 12
    audioEngine.resume()
    const ctx = audioEngine.getContext()
    pluckStringAt(str.freq * Math.pow(2, fret / 12), ctx.currentTime + 0.01, 0.6)
    onSelect({ semitone, duration: noteDuration, string: stringIdx, fret })
  }

  // Display strings high e at top, low E at bottom
  const displayStrings = [...STRINGS].map((s, i) => ({ ...s, strIdx: i })).reverse()

  return (
    <div className="overflow-x-auto scrollbar-none -mx-1">
      <div style={{ minWidth: 'max-content' }} className="px-1">
        {/* Fret numbers */}
        <div className="flex mb-0.5">
          <div className="w-6 shrink-0" />
          {Array.from({ length: FRET_COUNT }, (_, f) => (
            <div
              key={f}
              className="w-6 shrink-0 text-center text-[8px] text-zinc-600 leading-none pb-0.5"
            >
              {DOUBLE_DOTS.has(f) ? '••' : SINGLE_DOTS.has(f) ? '•' : f === 0 ? '空' : f}
            </div>
          ))}
        </div>

        {/* String rows */}
        {displayStrings.map(({ label, openSemitone, strIdx }) => (
          <div key={strIdx} className="flex items-center mb-0.5">
            {/* String label */}
            <div className="w-6 shrink-0 text-[9px] text-zinc-500 text-center font-medium">{label}</div>

            {/* Fret cells */}
            {Array.from({ length: FRET_COUNT }, (_, fret) => {
              const semitone = (openSemitone + fret) % 12
              const interval = (semitone - keyRoot + 12) % 12
              const sol = SOLFEGE_SHORT[interval]
              const isThisPos = selected?.string === strIdx && selected?.fret === fret
              const isSameSemi = !isThisPos && selected?.semitone === semitone
              const isNut = fret === 0

              return (
                <button
                  key={fret}
                  onClick={() => handlePick(strIdx, fret)}
                  className={`w-6 h-7 shrink-0 flex items-center justify-center text-[8px] font-bold border-l transition-colors select-none ${
                    isNut
                      ? 'border-zinc-500 border-l-2'
                      : 'border-zinc-700'
                  } ${
                    isThisPos
                      ? 'bg-amber-500 text-zinc-950 rounded-sm'
                      : isSameSemi
                        ? 'bg-amber-500/20 text-amber-400 rounded-sm'
                        : 'text-zinc-600 hover:bg-zinc-700/60 hover:text-zinc-300'
                  }`}
                >
                  {sol}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// Helper: human-readable position label for melody cells
export const STRING_LABELS = STRINGS.map(s => s.label)  // ['⑥','⑤','④','③','②','①']
