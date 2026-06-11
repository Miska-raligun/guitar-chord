import { useState, useCallback, useRef, useEffect } from 'react'
import { pluckStringAt } from '../../audio/karplusStrong'
import audioEngine from '../../audio/AudioEngine'
import { OPEN_STRING_FREQS } from '../../types/chord'

// ─── 常量 ─────────────────────────────────────────────────────
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]
const SOLFEGE = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si']
const NUMS    = ['1',  '2',  '3',  '4',  '5',   '6',  '7' ]

// OPEN_STRING_FREQS 索引：0=⑥低E, 5=①高e
// 横向布局：①e 在上，⑥E 在下（如持琴俯视）
const H_STRINGS = [
  { num: '①', name: 'e', openSemitone: 4,  freqIdx: 5 },
  { num: '②', name: 'B', openSemitone: 11, freqIdx: 4 },
  { num: '③', name: 'G', openSemitone: 7,  freqIdx: 3 },
  { num: '④', name: 'D', openSemitone: 2,  freqIdx: 2 },
  { num: '⑤', name: 'A', openSemitone: 9,  freqIdx: 1 },
  { num: '⑥', name: 'E', openSemitone: 4,  freqIdx: 0 },
]

// 竖向布局：⑥E 在左列，①e 在右列
const V_STRINGS = [
  { num: '⑥', name: 'E', openSemitone: 4,  freqIdx: 0 },
  { num: '⑤', name: 'A', openSemitone: 9,  freqIdx: 1 },
  { num: '④', name: 'D', openSemitone: 2,  freqIdx: 2 },
  { num: '③', name: 'G', openSemitone: 7,  freqIdx: 3 },
  { num: '②', name: 'B', openSemitone: 11, freqIdx: 4 },
  { num: '①', name: 'e', openSemitone: 4,  freqIdx: 5 },
]

const SINGLE_DOTS = new Set([3, 5, 7, 9, 15, 17, 19, 21])
const DOUBLE_DOTS = new Set([12, 24])

const ROOT_OPTIONS = [
  { label: 'C',  semitone: 0  }, { label: 'C#', semitone: 1  },
  { label: 'D',  semitone: 2  }, { label: 'Eb', semitone: 3  },
  { label: 'E',  semitone: 4  }, { label: 'F',  semitone: 5  },
  { label: 'F#', semitone: 6  }, { label: 'G',  semitone: 7  },
  { label: 'Ab', semitone: 8  }, { label: 'A',  semitone: 9  },
  { label: 'Bb', semitone: 10 }, { label: 'B',  semitone: 11 },
]

// ─── 工具 ─────────────────────────────────────────────────────
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

// ─── 音格组件（定义在外部避免每次渲染重新生成类型）────────────────
interface NoteCellProps {
  freqIdx: number
  fret: number
  openSemitone: number
  keyRoot: number
  activeCell: string | null
  className: string
  onPlay: (freqIdx: number, fret: number, cellKey: string) => void
}

function NoteCell({ freqIdx, fret, openSemitone, keyRoot, activeCell, className, onPlay }: NoteCellProps) {
  const semitone = (openSemitone + fret) % 12
  const { solfege, num, isDiatonic, isRoot } = getNoteInfo(semitone, keyRoot)
  const cellKey = `${freqIdx}-${fret}`
  const isActive = activeCell === cellKey

  return (
    <button
      onClick={() => onPlay(freqIdx, fret, cellKey)}
      className={`flex flex-col items-center justify-center border-l border-zinc-800 select-none transition-[filter]
        ${isRoot ? 'bg-amber-500' : isDiatonic ? 'bg-zinc-700' : 'bg-zinc-900'}
        ${isActive ? 'brightness-150' : 'hover:brightness-110 active:brightness-125'}
        ${className}`}
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
    </button>
  )
}

// ─── 主组件 ───────────────────────────────────────────────────
export default function FretboardTab() {
  const [keyRoot,      setKeyRoot]      = useState(0)
  const [isHorizontal, setIsHorizontal] = useState(true)
  const [activeCell,   setActiveCell]   = useState<string | null>(null)
  const clearRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (clearRef.current) clearTimeout(clearRef.current) }, [])

  const playNote = useCallback((freqIdx: number, fret: number, cellKey: string) => {
    audioEngine.resume()
    const ctx = audioEngine.getContext()
    const freq = OPEN_STRING_FREQS[freqIdx] * Math.pow(2, fret / 12)
    pluckStringAt(freq, ctx.currentTime + 0.01, 0.7)
    setActiveCell(cellKey)
    if (clearRef.current) clearTimeout(clearRef.current)
    clearRef.current = setTimeout(() => setActiveCell(null), 350)
  }, [])

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

      {/* 图例 + 布局切换 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-xs text-zinc-500">
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

        <div className="flex rounded-lg overflow-hidden border border-zinc-700 text-xs">
          <button
            onClick={() => setIsHorizontal(true)}
            className={`px-3 py-1.5 transition-colors ${
              isHorizontal
                ? 'bg-amber-500 text-zinc-950 font-semibold'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            横向
          </button>
          <button
            onClick={() => setIsHorizontal(false)}
            className={`px-3 py-1.5 border-l border-zinc-700 transition-colors ${
              !isHorizontal
                ? 'bg-amber-500 text-zinc-950 font-semibold'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            竖向
          </button>
        </div>
      </div>

      {/* ── 横向布局 ── */}
      {isHorizontal && (
        <div className="rounded-xl overflow-hidden border border-zinc-700">
          <div className="overflow-x-auto">
            <div className="flex flex-col w-full" style={{ minWidth: 'max-content' }}>

              {/* 品格编号行（带品记点） */}
              <div className="flex border-b-[3px] border-zinc-400 bg-zinc-900">
                {/* 左上角占位（sticky） */}
                <div className="sticky left-0 z-10 w-10 flex-shrink-0 bg-zinc-900 border-r border-zinc-700" />
                {Array.from({ length: 25 }, (_, f) => (
                  <div key={f} className="flex-1 min-w-[2.5rem] h-7 flex flex-col items-center justify-center gap-[1px]">
                    <span className="text-[9px] text-zinc-500 leading-none">{f === 0 ? '空' : f}</span>
                    {DOUBLE_DOTS.has(f) && <span className="text-[5px] text-amber-400/70 leading-none">●●</span>}
                    {SINGLE_DOTS.has(f) && <span className="text-[5px] text-zinc-600 leading-none">●</span>}
                  </div>
                ))}
              </div>

              {/* 弦行：①e（顶）→ ⑥E（底） */}
              {H_STRINGS.map((str, si) => (
                <div
                  key={str.num}
                  className={`flex ${si < H_STRINGS.length - 1 ? 'border-b border-zinc-800' : ''}`}
                >
                  {/* 弦标签（sticky 不随横向滚动消失） */}
                  <div className="sticky left-0 z-10 w-10 flex-shrink-0 flex flex-col items-center justify-center bg-zinc-900 border-r border-zinc-700">
                    <span className="text-[10px] text-zinc-300 font-mono leading-none">{str.num}</span>
                    <span className="text-[9px] text-zinc-500 font-mono leading-none">{str.name}</span>
                  </div>

                  {/* 25 品音格 */}
                  {Array.from({ length: 25 }, (_, f) => (
                    <NoteCell
                      key={`${str.freqIdx}-${f}`}
                      freqIdx={str.freqIdx}
                      fret={f}
                      openSemitone={str.openSemitone}
                      keyRoot={keyRoot}
                      activeCell={activeCell}
                      onPlay={playNote}
                      className="flex-1 min-w-[2.5rem] h-11"
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="text-[10px] text-zinc-600 text-center py-1.5 border-t border-zinc-800">
            ⑥E低音弦在下方 · 左右滑动查看全部品格 · 点击发音
          </div>
        </div>
      )}

      {/* ── 竖向布局 ── */}
      {!isHorizontal && (
        <div className="rounded-xl overflow-hidden border border-zinc-700">

          {/* 弦标题（琴枕上方） */}
          <div className="flex border-b-[3px] border-zinc-400 bg-zinc-800/60">
            <div className="w-9 flex-shrink-0 border-r border-zinc-700" />
            {V_STRINGS.map((str, si) => (
              <div
                key={str.num}
                className={`flex-1 flex flex-col items-center justify-center py-2 ${si > 0 ? 'border-l border-zinc-700' : ''}`}
              >
                <span className="text-xs text-zinc-300 font-mono leading-none">{str.num}</span>
                <span className="text-[10px] text-zinc-500 font-mono leading-none mt-0.5">{str.name}</span>
              </div>
            ))}
          </div>

          {/* 品格行 0-24 */}
          {Array.from({ length: 25 }, (_, f) => (
            <div
              key={f}
              className={`flex ${DOUBLE_DOTS.has(f) ? 'border-b-2 border-zinc-500' : 'border-b border-zinc-800'}`}
            >
              {/* 品格编号 + 品记点 */}
              <div className="w-9 flex-shrink-0 flex flex-col items-center justify-center gap-[2px] bg-zinc-900 border-r border-zinc-700 py-1">
                <span className="text-[11px] text-zinc-400 font-mono leading-none">{f === 0 ? '空' : f}</span>
                {DOUBLE_DOTS.has(f) && <span className="text-[7px] text-amber-400/60 leading-none">●●</span>}
                {SINGLE_DOTS.has(f) && <span className="text-[7px] text-zinc-600 leading-none">●</span>}
              </div>

              {/* 各弦音格 */}
              {V_STRINGS.map((str) => (
                <NoteCell
                  key={`${str.freqIdx}-${f}`}
                  freqIdx={str.freqIdx}
                  fret={f}
                  openSemitone={str.openSemitone}
                  keyRoot={keyRoot}
                  activeCell={activeCell}
                  onPlay={playNote}
                  className="flex-1 h-10"
                />
              ))}
            </div>
          ))}

          <div className="text-[10px] text-zinc-600 text-center py-1.5 border-t border-zinc-800">
            点击格子发音
          </div>
        </div>
      )}
    </div>
  )
}
