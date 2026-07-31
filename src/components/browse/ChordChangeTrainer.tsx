import { useState, useRef, useEffect, useCallback } from 'react'
import audioEngine from '../../audio/AudioEngine'
import { scheduleClick } from '../../hooks/useMetronome'
import { useChordDb } from '../../hooks/useChordDb'
import ChordDiagram from '../chord/ChordDiagram'

// 和弦转换练习：节拍器走拍，每 N 拍随机切换一个目标和弦，跟着按。
// 计时结束（或不限时手动结束）后记录完成了多少次干净的转换，保存最佳成绩。

export interface TrainerChord { root: string; suffix: string }

const BEST_KEY = 'chord-trainer-best'

// 0 = 不限时
const DURATION_OPTIONS = [30, 60, 90, 120, 0]

export function chordName(c: TrainerChord): string {
  return `${c.root}${c.suffix === 'major' ? '' : c.suffix === 'minor' ? 'm' : ' ' + c.suffix}`
}

function pairKey(list: TrainerChord[]): string {
  return list.map(chordName).sort().join('+')
}

function loadBest(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') } catch { return {} }
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

interface Props {
  list: TrainerChord[]
  onListChange: (list: TrainerChord[]) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ChordChangeTrainer({ list, onListChange, open, onOpenChange }: Props) {
  const { getChordEntry } = useChordDb()
  const [bpm, setBpm] = useState(60)
  const [beatsPerChange, setBeatsPerChange] = useState(4)
  const [duration, setDuration] = useState(60)          // 秒；0 = 不限时
  const [customDur, setCustomDur] = useState('180')     // 自定义秒数输入
  const [useCustom, setUseCustom] = useState(false)
  const [running, setRunning] = useState(false)
  const [display, setDisplay] = useState(0)             // 限时=剩余秒；不限时=已用秒
  const [activeIdx, setActiveIdx] = useState(0)
  const [finished, setFinished] = useState(false)
  const [scoreInput, setScoreInput] = useState('')
  const [best, setBest] = useState<Record<string, number>>(loadBest)

  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextTickRef  = useRef(0)
  const beatRef      = useRef(0)
  const startAtRef   = useRef(0)
  const endAtRef     = useRef(0)   // 0 = 不限时
  const activeIdxRef = useRef(0)
  const listRef      = useRef(list)
  const bpcRef       = useRef(beatsPerChange)
  useEffect(() => { listRef.current = list }, [list])
  useEffect(() => { bpcRef.current = beatsPerChange }, [beatsPerChange])

  const effectiveDuration = useCustom
    ? Math.max(5, Math.min(3600, Math.round(Number(customDur) || 0)))
    : duration

  const stop = useCallback((done: boolean) => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    setRunning(false)
    if (done) { setFinished(true); setScoreInput('') }
  }, [])

  const tick = useCallback(() => {
    const ctx = audioEngine.getContext()
    if (endAtRef.current > 0 && ctx.currentTime >= endAtRef.current) { stop(true); return }
    setDisplay(endAtRef.current > 0
      ? Math.max(0, Math.ceil(endAtRef.current - ctx.currentTime))
      : Math.floor(ctx.currentTime - startAtRef.current))

    while (nextTickRef.current < ctx.currentTime + 0.1) {
      const beat = beatRef.current
      scheduleClick(ctx, nextTickRef.current, beat % bpcRef.current === 0)
      if (beat > 0 && beat % bpcRef.current === 0) {
        const n = listRef.current.length
        if (n > 1) {
          let next = Math.floor(Math.random() * (n - 1))
          if (next >= activeIdxRef.current) next++
          activeIdxRef.current = next
          const ms = Math.max(0, (nextTickRef.current - ctx.currentTime) * 1000)
          setTimeout(() => setActiveIdx(next), ms)
        }
      }
      nextTickRef.current += 60 / bpm
      beatRef.current++
    }
  }, [bpm, stop])

  function start() {
    if (list.length < 2) return
    audioEngine.resume()
    const ctx = audioEngine.getContext()
    beatRef.current = 0
    activeIdxRef.current = 0
    setActiveIdx(0)
    setFinished(false)
    nextTickRef.current = ctx.currentTime + 0.1
    startAtRef.current  = ctx.currentTime
    endAtRef.current    = effectiveDuration > 0 ? ctx.currentTime + effectiveDuration : 0
    setDisplay(effectiveDuration > 0 ? effectiveDuration : 0)
    setRunning(true)
    intervalRef.current = setInterval(tick, 25)
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  function saveScore() {
    const n = Number(scoreInput)
    if (!Number.isFinite(n) || n <= 0) { setFinished(false); return }
    const key = pairKey(list)
    const next = { ...best, [key]: Math.max(best[key] ?? 0, Math.round(n)) }
    setBest(next)
    try { localStorage.setItem(BEST_KEY, JSON.stringify(next)) } catch { /* ignore */ }
    setFinished(false)
  }

  const active = list[activeIdx]
  const activeEntry = active ? getChordEntry(active.root, active.suffix) : null
  const bestForList = list.length >= 2 ? best[pairKey(list)] : undefined
  const unlimited = effectiveDuration === 0

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900/60 overflow-hidden">
      <button
        onClick={() => onOpenChange(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800/60"
      >
        <span className="font-medium">
          ⏱ 和弦转换练习
          {list.length > 0 && <span className="ml-2 text-xs text-amber-400">已选 {list.length} 个</span>}
        </span>
        <span className="text-zinc-500 text-xs">{open ? '收起 ▲' : '展开 ▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            在上方和弦区点「加入练习」选 2–4 个和弦，节拍器每 {beatsPerChange} 拍随机换一个目标，跟着按。结束后数一数完成了几次干净转换。
          </p>

          {/* 已选和弦 */}
          <div className="flex items-center gap-1.5 flex-wrap min-h-[1.75rem]">
            {list.length === 0 && <span className="text-xs text-zinc-600">还没有选择和弦</span>}
            {list.map((c, i) => (
              <span key={i} className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 text-xs text-zinc-200">
                {chordName(c)}
                <button
                  onClick={() => onListChange(list.filter((_, j) => j !== i))}
                  aria-label={`移除 ${chordName(c)}`}
                  disabled={running}
                  className="text-zinc-500 hover:text-red-400 disabled:opacity-30"
                >✕</button>
              </span>
            ))}
            {list.length > 0 && !running && (
              <button
                onClick={() => onListChange([])}
                className="text-[11px] text-zinc-600 hover:text-zinc-400 px-1"
              >清空</button>
            )}
          </div>

          {/* 参数 */}
          <div className="flex items-center gap-3 text-xs text-zinc-400 flex-wrap">
            <label className="flex items-center gap-1.5">
              速度
              <input
                type="number" min={30} max={160} value={bpm} disabled={running}
                onChange={e => setBpm(Math.max(30, Math.min(160, Number(e.target.value) || 60)))}
                aria-label="练习速度 BPM"
                className="w-14 bg-zinc-800 text-zinc-200 rounded-md px-1.5 py-1 border border-zinc-700 outline-none text-center focus:border-amber-500"
              /> BPM
            </label>
            <label className="flex items-center gap-1.5">
              每
              <select
                value={beatsPerChange} disabled={running}
                onChange={e => setBeatsPerChange(Number(e.target.value))}
                aria-label="每几拍换一次和弦"
                className="bg-zinc-800 text-zinc-200 rounded-md px-1.5 py-1 border border-zinc-700 outline-none"
              >
                <option value={2}>2</option>
                <option value={4}>4</option>
                <option value={8}>8</option>
              </select>
              拍换一次
            </label>
          </div>

          {/* 时长 */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-zinc-500">时长</span>
            {DURATION_OPTIONS.map(d => (
              <button
                key={d}
                disabled={running}
                onClick={() => { setUseCustom(false); setDuration(d) }}
                className={`px-2 py-1 rounded-md transition-colors disabled:opacity-40 ${
                  !useCustom && duration === d
                    ? 'bg-amber-500 text-zinc-950 font-semibold'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >{d === 0 ? '不限时' : `${d}秒`}</button>
            ))}
            <button
              disabled={running}
              onClick={() => setUseCustom(true)}
              className={`px-2 py-1 rounded-md transition-colors disabled:opacity-40 ${
                useCustom ? 'bg-amber-500 text-zinc-950 font-semibold' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >自定义</button>
            {useCustom && (
              <span className="flex items-center gap-1 text-zinc-400">
                <input
                  type="number" min={5} max={3600} value={customDur} disabled={running}
                  onChange={e => setCustomDur(e.target.value)}
                  aria-label="自定义练习秒数"
                  className="w-16 bg-zinc-800 text-zinc-200 rounded-md px-1.5 py-1 border border-zinc-700 outline-none text-center focus:border-amber-500"
                />秒
              </span>
            )}
          </div>

          {bestForList !== undefined && (
            <div className="text-xs text-amber-400">历史最佳 {bestForList} 次</div>
          )}

          {/* 运行区 */}
          {running && active ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="text-xs text-zinc-500">
                {unlimited ? `已练 ${fmtTime(display)}` : `剩余 ${display} 秒`}
              </div>
              <div className="text-4xl font-bold text-amber-400">{chordName(active)}</div>
              {activeEntry?.positions[0] && <ChordDiagram position={activeEntry.positions[0]} lite />}
              <button
                onClick={() => stop(true)}
                className="px-4 py-1.5 rounded-lg bg-amber-500 text-zinc-950 text-xs font-semibold hover:bg-amber-400"
              >{unlimited ? '结束并记录' : '提前结束'}</button>
            </div>
          ) : finished ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="text-sm text-zinc-200">这一轮完成了多少次转换？</div>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} value={scoreInput}
                  onChange={e => setScoreInput(e.target.value)}
                  aria-label="完成次数"
                  className="w-20 bg-zinc-800 text-zinc-200 rounded-md px-2 py-1.5 border border-zinc-700 outline-none text-center focus:border-amber-500"
                  placeholder="次数"
                />
                <button
                  onClick={saveScore}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-zinc-950 text-xs font-semibold hover:bg-amber-400"
                >记录</button>
                <button
                  onClick={() => setFinished(false)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-xs hover:bg-zinc-700"
                >跳过</button>
              </div>
            </div>
          ) : (
            <button
              onClick={start}
              disabled={list.length < 2}
              className="self-center px-6 py-2 rounded-xl bg-amber-500 text-zinc-950 text-sm font-semibold hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500"
            >
              {list.length < 2 ? '至少加入 2 个和弦' : unlimited ? '开始练习（不限时）' : `开始 ${effectiveDuration} 秒练习`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
