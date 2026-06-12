import { useState, useRef } from 'react'
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

const SCALE_OPTIONS = [
  { key: 'all',        label: '全部',     intervals: null as number[] | null },
  { key: 'major',      label: '大调',     intervals: [0, 2, 4, 5, 7, 9, 11] },
  { key: 'natMinor',   label: '自然小调',  intervals: [0, 2, 3, 5, 7, 8, 10] },
  { key: 'majorPenta', label: '大调五声',  intervals: [0, 2, 4, 7, 9] },
  { key: 'minorPenta', label: '小调五声',  intervals: [0, 3, 5, 7, 10] },
  { key: 'blues',      label: '布鲁斯',   intervals: [0, 3, 5, 6, 7, 10] },
]

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]
const SOLFEGE = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si']
const NUMS    = ['1',  '2',  '3',  '4',  '5',   '6',  '7']

const SINGLE_DOTS = new Set([3, 5, 7, 9, 15, 17, 19, 21])
const DOUBLE_DOTS = new Set([12, 24])

const FRET_COLS = 25  // shows frets 0–24

function getNoteInfo(semitone: number, keyRoot: number) {
  const interval = (semitone - keyRoot + 12) % 12
  const dIdx = MAJOR_INTERVALS.indexOf(interval)
  if (dIdx !== -1) {
    return { solfege: SOLFEGE[dIdx], num: NUMS[dIdx], isDiatonic: true, isRoot: interval === 0 }
  }
  let lowerIdx = 0
  for (let i = MAJOR_INTERVALS.length - 1; i >= 0; i--) {
    if (MAJOR_INTERVALS[i] < interval) { lowerIdx = i; break }
  }
  return { solfege: '♯' + SOLFEGE[lowerIdx], num: '♯' + NUMS[lowerIdx], isDiatonic: false, isRoot: false }
}

interface Props {
  keyRoot: number
  noteDuration: number
  selected: MelodyNote | null
  onSelect: (note: MelodyNote) => void
}

export default function FretboardNotePicker({ keyRoot, noteDuration, selected, onSelect }: Props) {
  const [scaleKey, setScaleKey]   = useState('all')
  const [activeCell, setActiveCell] = useState<string | null>(null)
  const clearRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scaleIntervals = SCALE_OPTIONS.find(s => s.key === scaleKey)?.intervals ?? null

  // Display strings: ① (high e) top → ⑥ (low E) bottom
  const displayStrings = [...STRINGS].map((s, i) => ({ ...s, strIdx: i })).reverse()

  function handlePick(strIdx: number, fret: number) {
    const str = STRINGS[strIdx]
    const semitone = (str.openSemitone + fret) % 12
    audioEngine.resume()
    const ctx = audioEngine.getContext()
    pluckStringAt(str.freq * Math.pow(2, fret / 12), ctx.currentTime + 0.01, 0.6)
    const cellKey = `${strIdx}-${fret}`
    setActiveCell(cellKey)
    if (clearRef.current) clearTimeout(clearRef.current)
    clearRef.current = setTimeout(() => setActiveCell(null), 350)
    onSelect({ semitone, duration: noteDuration, string: strIdx, fret })
  }

  return (
    <div className="flex flex-col gap-2.5">

      {/* Scale selector */}
      <div className="flex flex-wrap gap-1.5">
        {SCALE_OPTIONS.map(s => (
          <button
            key={s.key}
            onClick={() => setScaleKey(s.key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              scaleKey === s.key
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Fretboard */}
      <div className="rounded-xl overflow-hidden border border-zinc-700">
        <div className="overflow-x-auto scrollbar-none">
          <div className="flex flex-col w-full" style={{ minWidth: 'max-content' }}>

            {/* Fret number row */}
            <div className="flex border-b-[3px] border-zinc-400 bg-zinc-900">
              <div className="sticky left-0 z-10 w-10 flex-shrink-0 bg-zinc-900 border-r border-zinc-700" />
              {Array.from({ length: FRET_COLS }, (_, f) => (
                <div key={f} className="flex-1 min-w-[2.5rem] h-7 flex flex-col items-center justify-center gap-[1px]">
                  <span className="text-[9px] text-zinc-500 leading-none">{f === 0 ? '空' : f}</span>
                  {DOUBLE_DOTS.has(f) && <span className="text-[5px] text-amber-400/70 leading-none">●●</span>}
                  {SINGLE_DOTS.has(f) && <span className="text-[5px] text-zinc-600 leading-none">●</span>}
                </div>
              ))}
            </div>

            {/* String rows: ① top → ⑥ bottom */}
            {displayStrings.map((str, si) => (
              <div
                key={str.strIdx}
                className={`flex ${si < displayStrings.length - 1 ? 'border-b border-zinc-800' : ''}`}
              >
                {/* Sticky string label */}
                <div className="sticky left-0 z-10 w-10 flex-shrink-0 flex flex-col items-center justify-center bg-zinc-900 border-r border-zinc-700">
                  <span className="text-[10px] text-zinc-300 font-mono leading-none">{str.label}</span>
                  <span className="text-[9px] text-zinc-500 font-mono leading-none">{str.name}</span>
                </div>

                {/* Note cells */}
                {Array.from({ length: FRET_COLS }, (_, fret) => {
                  const semitone = (str.openSemitone + fret) % 12
                  const interval = (semitone - keyRoot + 12) % 12
                  const inScale = scaleIntervals === null || scaleIntervals.includes(interval)
                  const { solfege, num, isDiatonic, isRoot } = getNoteInfo(semitone, keyRoot)
                  const cellKey = `${str.strIdx}-${fret}`
                  const isFlash   = activeCell === cellKey
                  const isPicked  = selected?.string === str.strIdx && selected?.fret === fret
                  const isSameSemi = !isPicked && selected?.semitone === semitone

                  if (!inScale) {
                    return (
                      <button
                        key={fret}
                        onClick={() => handlePick(str.strIdx, fret)}
                        className={`flex-1 min-w-[2.5rem] h-11 flex items-center justify-center bg-zinc-900 border-l border-zinc-800 select-none transition-[filter] ${
                          isFlash || isPicked ? 'brightness-200' : 'hover:brightness-150'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                      </button>
                    )
                  }

                  const effectiveDiatonic = isDiatonic || scaleIntervals !== null
                  const bgClass = isPicked
                    ? 'bg-amber-400 ring-2 ring-amber-200'
                    : isRoot
                      ? 'bg-amber-500'
                      : effectiveDiatonic ? 'bg-zinc-700' : 'bg-zinc-900'
                  const topClass = isPicked
                    ? 'text-zinc-950'
                    : isRoot ? 'text-zinc-900' : effectiveDiatonic ? 'text-amber-400' : 'text-zinc-600'
                  const botClass = isPicked
                    ? 'text-zinc-950 font-extrabold'
                    : isRoot ? 'text-zinc-950' : effectiveDiatonic ? 'text-amber-100' : 'text-zinc-500'

                  return (
                    <button
                      key={fret}
                      onClick={() => handlePick(str.strIdx, fret)}
                      className={`flex-1 min-w-[2.5rem] h-11 flex flex-col items-center justify-center border-l border-zinc-800 select-none transition-[filter] ${bgClass} ${
                        isFlash ? 'brightness-150' : isSameSemi ? 'ring-1 ring-inset ring-amber-500/60' : 'hover:brightness-110 active:brightness-125'
                      }`}
                    >
                      <span className={`text-[9px] leading-none mb-[2px] ${topClass}`}>{solfege}</span>
                      <span className={`text-xs font-bold leading-none ${botClass}`}>{num}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="text-[10px] text-zinc-600 text-center py-1 border-t border-zinc-800">
          点击选音并发音 · 左右滑动查看更多品格
        </div>
      </div>
    </div>
  )
}

// Helper: human-readable position label for melody cells
export const STRING_LABELS = STRINGS.map(s => s.label)  // ['⑥','⑤','④','③','②','①']
