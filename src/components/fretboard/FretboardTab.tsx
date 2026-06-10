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
const SOLFEGE  = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si']
const NUMS     = ['1',  '2',  '3',  '4',  '5',   '6',  '7' ]

const SINGLE_DOTS = new Set([3, 5, 7, 9, 15, 17, 19, 21])
const DOUBLE_DOTS = new Set([12, 24])

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

      {/* 指板主体（竖向：每行一品，每列一弦） */}
      <div className="rounded-xl overflow-hidden border border-zinc-700">

        {/* 弦标题行（琴枕上方） */}
        <div className="flex border-b-[3px] border-zinc-400 bg-zinc-800/80">
          <div className="w-9 flex-shrink-0 border-r border-zinc-700" />
          {STRINGS.map((str, si) => (
            <div
              key={si}
              className={`flex-1 flex flex-col items-center justify-center py-2 ${
                si > 0 ? 'border-l border-zinc-700' : ''
              }`}
            >
              <span className="text-xs text-zinc-300 font-mono leading-none">{str.num}</span>
              <span className="text-[10px] text-zinc-500 font-mono leading-none mt-0.5">{str.name}</span>
            </div>
          ))}
        </div>

        {/* 品格行 0-24 */}
        {Array.from({ length: 25 }, (_, f) => {
          const isOctave = DOUBLE_DOTS.has(f)
          const hasDot   = SINGLE_DOTS.has(f)

          return (
            <div
              key={f}
              className={`flex ${
                isOctave ? 'border-b-2 border-zinc-500' : 'border-b border-zinc-800'
              }`}
            >
              {/* 品格编号 + 品记点 */}
              <div className="w-9 flex-shrink-0 flex flex-col items-center justify-center gap-0.5 bg-zinc-900 border-r border-zinc-700 py-1">
                <span className="text-[11px] text-zinc-400 font-mono leading-none">
                  {f === 0 ? '空' : f}
                </span>
                {isOctave && <span className="text-[7px] text-amber-500/70 leading-none">●●</span>}
                {hasDot   && <span className="text-[7px] text-zinc-500 leading-none">●</span>}
              </div>

              {/* 各弦音格 */}
              {STRINGS.map((str, si) => {
                const semitone = (str.openSemitone + f) % 12
                const { solfege, num, isDiatonic, isRoot } = getNoteInfo(semitone, keyRoot)

                return (
                  <div
                    key={si}
                    className={`flex-1 h-10 flex flex-col items-center justify-center border-l border-zinc-800 ${
                      isRoot ? 'bg-amber-500' : isDiatonic ? 'bg-zinc-700' : 'bg-zinc-900'
                    }`}
                  >
                    <span className={`text-[9px] leading-none mb-[2px] ${
                      isRoot ? 'text-zinc-900' : isDiatonic ? 'text-amber-400' : 'text-zinc-600'
                    }`}>
                      {solfege}
                    </span>
                    <span className={`text-xs font-bold leading-none ${
                      isRoot ? 'text-zinc-950' : isDiatonic ? 'text-amber-100' : 'text-zinc-500'
                    }`}>
                      {num}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-zinc-600 text-center pb-4">大调音阶 · 切换调性可实时刷新</p>
    </div>
  )
}
