import { useState, useCallback, useRef } from 'react'
import { pluckStringAt } from '../../audio/karplusStrong'
import audioEngine from '../../audio/AudioEngine'

// ─── 调音配置 ──────────────────────────────────────────────────
const TUNINGS = [
  {
    key: 'standard',
    label: '标准 EADGBe',
    strings: [
      { name: 'E', openSemitone: 4,  freq: 82.41  },
      { name: 'A', openSemitone: 9,  freq: 110.0  },
      { name: 'D', openSemitone: 2,  freq: 146.83 },
      { name: 'G', openSemitone: 7,  freq: 196.0  },
      { name: 'B', openSemitone: 11, freq: 246.94 },
      { name: 'e', openSemitone: 4,  freq: 329.63 },
    ],
  },
  {
    key: 'dropD',
    label: 'Drop D',
    strings: [
      { name: 'D', openSemitone: 2,  freq: 73.42  },
      { name: 'A', openSemitone: 9,  freq: 110.0  },
      { name: 'D', openSemitone: 2,  freq: 146.83 },
      { name: 'G', openSemitone: 7,  freq: 196.0  },
      { name: 'B', openSemitone: 11, freq: 246.94 },
      { name: 'e', openSemitone: 4,  freq: 329.63 },
    ],
  },
  {
    key: 'dropC',
    label: 'Drop C',
    strings: [
      { name: 'C', openSemitone: 0,  freq: 65.41  },
      { name: 'G', openSemitone: 7,  freq: 98.0   },
      { name: 'C', openSemitone: 0,  freq: 130.81 },
      { name: 'F', openSemitone: 5,  freq: 174.61 },
      { name: 'A', openSemitone: 9,  freq: 220.0  },
      { name: 'd', openSemitone: 2,  freq: 293.66 },
    ],
  },
] as const

type TuningKey = typeof TUNINGS[number]['key']

// ─── 音阶配置 ──────────────────────────────────────────────────
const SCALE_OPTIONS = [
  { key: 'all',        label: '全部',    intervals: null },
  { key: 'major',      label: '大调',    intervals: [0, 2, 4, 5, 7, 9, 11] },
  { key: 'natMinor',   label: '自然小调', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { key: 'majorPenta', label: '大调五声', intervals: [0, 2, 4, 7, 9] },
  { key: 'minorPenta', label: '小调五声', intervals: [0, 3, 5, 7, 10] },
  { key: 'blues',      label: '布鲁斯',  intervals: [0, 3, 5, 6, 7, 10] },
] as const

type ScaleKey = typeof SCALE_OPTIONS[number]['key']

// ─── 常量 ─────────────────────────────────────────────────────
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]
const SOLFEGE = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si']
const NUMS    = ['1',  '2',  '3',  '4',  '5',   '6',  '7' ]
const STRING_NUMS = ['⑥', '⑤', '④', '③', '②', '①'] as const

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

// ─── 音格组件 ─────────────────────────────────────────────────
interface NoteCellProps {
  freqIdx: number
  fret: number
  openSemitone: number
  keyRoot: number
  scaleIntervals: readonly number[] | null
  activeCell: string | null
  className: string
  onPlay: (freqIdx: number, fret: number, cellKey: string) => void
}

function NoteCell({ freqIdx, fret, openSemitone, keyRoot, scaleIntervals, activeCell, className, onPlay }: NoteCellProps) {
  const semitone = (openSemitone + fret) % 12
  const interval = (semitone - keyRoot + 12) % 12
  const inScale = scaleIntervals === null || scaleIntervals.includes(interval)
  const { solfege, num, isDiatonic, isRoot } = getNoteInfo(semitone, keyRoot)
  const cellKey = `${freqIdx}-${fret}`
  const isActive = activeCell === cellKey

  if (!inScale) {
    return (
      <button
        onClick={() => onPlay(freqIdx, fret, cellKey)}
        className={`flex items-center justify-center bg-zinc-900 border-l border-zinc-800 select-none transition-[filter]
          ${isActive ? 'brightness-200' : 'hover:brightness-125'}
          ${className}`}
      >
        <span className="w-1 h-1 rounded-full bg-zinc-800" />
      </button>
    )
  }

  // When scale is active, treat non-major-diatonic notes as diatonic-styled if they're in the scale
  const effectiveDiatonic = isDiatonic || scaleIntervals !== null
  const bgClass = isRoot ? 'bg-amber-500' : (effectiveDiatonic ? 'bg-zinc-700' : 'bg-zinc-900')
  const topTextClass = isRoot ? 'text-zinc-900' : (effectiveDiatonic ? 'text-amber-400' : 'text-zinc-600')
  const botTextClass = isRoot ? 'text-zinc-950' : (effectiveDiatonic ? 'text-amber-100' : 'text-zinc-500')

  return (
    <button
      onClick={() => onPlay(freqIdx, fret, cellKey)}
      className={`flex flex-col items-center justify-center border-l border-zinc-800 select-none transition-[filter]
        ${bgClass}
        ${isActive ? 'brightness-150' : 'hover:brightness-110 active:brightness-125'}
        ${className}`}
    >
      <span className={`text-[9px] leading-none mb-[2px] ${topTextClass}`}>{solfege}</span>
      <span className={`text-xs font-bold leading-none ${botTextClass}`}>{num}</span>
    </button>
  )
}

// ─── 主组件 ───────────────────────────────────────────────────
export default function FretboardTab() {
  const [keyRoot,      setKeyRoot]      = useState(0)
  const [isHorizontal, setIsHorizontal] = useState(true)
  const [activeCell,   setActiveCell]   = useState<string | null>(null)
  const [tuningKey,    setTuningKey]    = useState<TuningKey>('standard')
  const [scaleKey,     setScaleKey]     = useState<ScaleKey>('all')

  const clearRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tuningRef = useRef<typeof TUNINGS[number]>(TUNINGS[0])

  const currentTuning = TUNINGS.find(t => t.key === tuningKey) ?? TUNINGS[0]
  tuningRef.current = currentTuning

  const scaleIntervals = SCALE_OPTIONS.find(s => s.key === scaleKey)?.intervals ?? null

  // Horizontal: ① (high e) → ⑥ (low E), reversed from tuning order
  const hStrings = [...currentTuning.strings]
    .map((s, i) => ({ num: STRING_NUMS[i], name: s.name, openSemitone: s.openSemitone, freqIdx: i }))
    .reverse()

  // Vertical: ⑥ (low E) → ① (high e), natural tuning order
  const vStrings = currentTuning.strings.map((s, i) => ({
    num: STRING_NUMS[i], name: s.name, openSemitone: s.openSemitone, freqIdx: i,
  }))

  const playNote = useCallback((freqIdx: number, fret: number, cellKey: string) => {
    audioEngine.resume()
    const ctx = audioEngine.getContext()
    const freq = tuningRef.current.strings[freqIdx].freq * Math.pow(2, fret / 12)
    pluckStringAt(freq, ctx.currentTime + 0.01, 0.7)
    setActiveCell(cellKey)
    if (clearRef.current) clearTimeout(clearRef.current)
    clearRef.current = setTimeout(() => setActiveCell(null), 350)
  }, [])

  return (
    <div className="flex flex-col gap-4 px-4 py-5">

      {/* 调音选择 */}
      <div>
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">调音</div>
        <div className="flex gap-1.5">
          {TUNINGS.map(t => (
            <button
              key={t.key}
              onClick={() => setTuningKey(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tuningKey === t.key
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 调性选择（同时作为音阶根音） */}
      <div>
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">调性 / 音阶根音</div>
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

      {/* 音阶选择 */}
      <div>
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">音阶</div>
        <div className="flex flex-wrap gap-1.5">
          {SCALE_OPTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => setScaleKey(s.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                scaleKey === s.key
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {s.label}
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
            <span className="inline-block w-3 h-3 rounded-sm bg-zinc-700" />音阶音
          </span>
          {scaleKey === 'all' && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-zinc-900 border border-zinc-700" />调外音
            </span>
          )}
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
          <div className="overflow-x-auto scrollbar-none">
            <div className="flex flex-col w-full" style={{ minWidth: 'max-content' }}>

              {/* 品格编号行 */}
              <div className="flex border-b-[3px] border-zinc-400 bg-zinc-900">
                <div className="sticky left-0 z-10 w-10 flex-shrink-0 bg-zinc-900 border-r border-zinc-700" />
                {Array.from({ length: 25 }, (_, f) => (
                  <div key={f} className="flex-1 min-w-[2.5rem] h-7 flex flex-col items-center justify-center gap-[1px]">
                    <span className="text-[9px] text-zinc-500 leading-none">{f === 0 ? '空' : f}</span>
                    {DOUBLE_DOTS.has(f) && <span className="text-[5px] text-amber-400/70 leading-none">●●</span>}
                    {SINGLE_DOTS.has(f) && <span className="text-[5px] text-zinc-600 leading-none">●</span>}
                  </div>
                ))}
              </div>

              {/* 弦行：① (top) → ⑥ (bottom) */}
              {hStrings.map((str, si) => (
                <div
                  key={`${str.freqIdx}-${str.name}`}
                  className={`flex ${si < hStrings.length - 1 ? 'border-b border-zinc-800' : ''}`}
                >
                  <div className="sticky left-0 z-10 w-10 flex-shrink-0 flex flex-col items-center justify-center bg-zinc-900 border-r border-zinc-700">
                    <span className="text-[10px] text-zinc-300 font-mono leading-none">{str.num}</span>
                    <span className="text-[9px] text-zinc-500 font-mono leading-none">{str.name}</span>
                  </div>
                  {Array.from({ length: 25 }, (_, f) => (
                    <NoteCell
                      key={`${str.freqIdx}-${f}`}
                      freqIdx={str.freqIdx}
                      fret={f}
                      openSemitone={str.openSemitone}
                      keyRoot={keyRoot}
                      scaleIntervals={scaleIntervals}
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
            ⑥低音弦在下方 · 左右滑动查看全部品格 · 点击发音
          </div>
        </div>
      )}

      {/* ── 竖向布局 ── */}
      {!isHorizontal && (
        <div className="rounded-xl overflow-hidden border border-zinc-700">

          {/* 弦标题 */}
          <div className="flex border-b-[3px] border-zinc-400 bg-zinc-800/60">
            <div className="w-9 flex-shrink-0 border-r border-zinc-700" />
            {vStrings.map((str, si) => (
              <div
                key={`${str.freqIdx}-${str.name}`}
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
              <div className="w-9 flex-shrink-0 flex flex-col items-center justify-center gap-[2px] bg-zinc-900 border-r border-zinc-700 py-1">
                <span className="text-[11px] text-zinc-400 font-mono leading-none">{f === 0 ? '空' : f}</span>
                {DOUBLE_DOTS.has(f) && <span className="text-[7px] text-amber-400/60 leading-none">●●</span>}
                {SINGLE_DOTS.has(f) && <span className="text-[7px] text-zinc-600 leading-none">●</span>}
              </div>
              {vStrings.map((str) => (
                <NoteCell
                  key={`${str.freqIdx}-${f}`}
                  freqIdx={str.freqIdx}
                  fret={f}
                  openSemitone={str.openSemitone}
                  keyRoot={keyRoot}
                  scaleIntervals={scaleIntervals}
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
