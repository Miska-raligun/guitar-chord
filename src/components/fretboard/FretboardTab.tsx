import { useState } from 'react'

const STRINGS = [
  { num: '⑥', name: 'E', openSemitone: 4 },
  { num: '⑤', name: 'A', openSemitone: 9 },
  { num: '④', name: 'D', openSemitone: 2 },
  { num: '③', name: 'G', openSemitone: 7 },
  { num: '②', name: 'B', openSemitone: 11 },
  { num: '①', name: 'e', openSemitone: 4 },
]

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]
const SOLFEGE = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si']
const NUMS = ['1', '2', '3', '4', '5', '6', '7']
const FRET_MARKERS = new Set([3, 5, 7, 9, 12])
const NUM_FRETS = 13

const ROOT_OPTIONS = [
  { label: 'C',  semitone: 0  },
  { label: 'C#', semitone: 1  },
  { label: 'D',  semitone: 2  },
  { label: 'Eb', semitone: 3  },
  { label: 'E',  semitone: 4  },
  { label: 'F',  semitone: 5  },
  { label: 'F#', semitone: 6  },
  { label: 'G',  semitone: 7  },
  { label: 'Ab', semitone: 8  },
  { label: 'A',  semitone: 9  },
  { label: 'Bb', semitone: 10 },
  { label: 'B',  semitone: 11 },
]

function getNoteInfo(semitone: number, keyRoot: number) {
  const interval = (semitone - keyRoot + 12) % 12
  const dIdx = MAJOR_INTERVALS.indexOf(interval)
  if (dIdx !== -1) {
    return { solfege: SOLFEGE[dIdx], num: NUMS[dIdx], isDiatonic: true, isRoot: interval === 0 }
  }
  // Find the nearest lower scale degree for chromatic note labeling
  let lowerIdx = 0
  for (let i = MAJOR_INTERVALS.length - 1; i >= 0; i--) {
    if (MAJOR_INTERVALS[i] < interval) { lowerIdx = i; break }
  }
  return { solfege: '♯' + SOLFEGE[lowerIdx], num: '♯' + NUMS[lowerIdx], isDiatonic: false, isRoot: false }
}

export default function FretboardTab() {
  const [keyRoot, setKeyRoot] = useState(0)

  return (
    <div className="flex flex-col gap-4 px-4 py-5">
      {/* 调性选择 */}
      <div>
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">调性</div>
        <div className="grid grid-cols-6 gap-1.5">
          {ROOT_OPTIONS.map(({ label, semitone }) => (
            <button
              key={semitone}
              onClick={() => setKeyRoot(semitone)}
              className={`py-2 rounded-lg text-xs font-mono font-semibold transition-colors ${
                keyRoot === semitone
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 图例 */}
      <div className="flex gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-500" />根音
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-zinc-700" />调内音
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-zinc-900 border border-zinc-700" />调外音
        </span>
      </div>

      {/* 指板（横向滚动） */}
      <div className="overflow-x-auto -mx-4 pb-2">
        <div className="inline-flex flex-col px-4" style={{ minWidth: 'max-content' }}>

          {/* 品格编号行 */}
          <div className="flex mb-0.5">
            <div className="w-8 flex-shrink-0" />
            {Array.from({ length: NUM_FRETS }, (_, f) => (
              <div key={f} className="w-11 flex-shrink-0 text-center text-[9px] text-zinc-600 leading-tight">
                {f === 0 ? '空弦' : f}
              </div>
            ))}
          </div>

          {/* 品记点行 */}
          <div className="flex mb-1">
            <div className="w-8 flex-shrink-0" />
            {Array.from({ length: NUM_FRETS }, (_, f) => (
              <div key={f} className="w-11 flex-shrink-0 h-3 flex items-center justify-center">
                {f === 12
                  ? <span className="text-[6px] text-zinc-500 tracking-[3px]">●●</span>
                  : FRET_MARKERS.has(f)
                  ? <span className="text-[7px] text-zinc-500">●</span>
                  : null}
              </div>
            ))}
          </div>

          {/* 弦行 */}
          {STRINGS.map((str, si) => (
            <div key={si} className="flex">
              {/* 弦标签 */}
              <div className="w-8 flex-shrink-0 flex flex-col items-center justify-center leading-none">
                <span className="text-[10px] text-zinc-400 font-mono">{str.num}</span>
                <span className="text-[9px] text-zinc-600 font-mono">{str.name}</span>
              </div>

              {/* 音格 */}
              {Array.from({ length: NUM_FRETS }, (_, f) => {
                const semitone = (str.openSemitone + f) % 12
                const { solfege, num, isDiatonic, isRoot } = getNoteInfo(semitone, keyRoot)

                return (
                  <div
                    key={f}
                    className={`w-11 h-12 flex-shrink-0 flex flex-col items-center justify-center
                      border-b border-r border-zinc-800
                      ${si === 0 ? 'border-t border-t-zinc-800' : ''}
                      ${f === 0 ? 'border-r-2 border-r-zinc-500' : ''}
                      ${isRoot ? 'bg-amber-500' : isDiatonic ? 'bg-zinc-700' : 'bg-zinc-900'}
                    `}
                  >
                    <span className={`text-[8px] leading-none mb-0.5 ${
                      isRoot ? 'text-zinc-900' : isDiatonic ? 'text-amber-400' : 'text-zinc-600'
                    }`}>
                      {solfege}
                    </span>
                    <span className={`text-[11px] font-bold leading-none ${
                      isRoot ? 'text-zinc-950' : isDiatonic ? 'text-amber-100' : 'text-zinc-500'
                    }`}>
                      {num}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-zinc-600 text-center">大调音阶 · 横向滑动查看更多品格</p>
    </div>
  )
}
