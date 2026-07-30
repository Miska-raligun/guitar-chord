import { useState, useRef, useEffect, useCallback } from 'react'
import audioEngine from '../../audio/AudioEngine'
import { scheduleClick } from '../../hooks/useMetronome'
import { useChordDb } from '../../hooks/useChordDb'
import ChordDiagram from '../chord/ChordDiagram'
import { prettifySuffix } from '../../utils/dbUtils'

// 经典"一分钟和弦转换"练习：节拍器走拍，每 N 拍随机切换一个目标和弦，
// 60 秒后自己数完成了多少次干净的转换，记录最佳成绩。

interface TrainerChord { root: string; suffix: string }

const DURATION_S = 60
const BEST_KEY = 'chord-trainer-best'

function chordName(c: TrainerChord): string {
  return `${c.root}${c.suffix === 'major' ? '' : c.suffix === 'minor' ? 'm' : ' ' + c.suffix}`
}

function pairKey(list: TrainerChord[]): string {
  return list.map(chordName).sort().join('+')
}

function loadBest(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') } catch { return {} }
}

interface Props {
  currentRoot: string
  currentSuffix: string
}

export default function ChordChangeTrainer({ currentRoot, currentSuffix }: Props) {
  const { getChordEntry } = useChordDb()
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<TrainerChord[]>([])
  const [bpm, setBpm] = useState(60)
  const [beatsPerChange, setBeatsPerChange] = useState(4)
  const [running, setRunning] = useState(false)
  const [timeLeft, setTimeLeft] = useState(DURATION_S)
  const [activeIdx, setActiveIdx] = useState(0)
  const [finished, setFinished] = useState(false)
  const [scoreInput, setScoreInput] = useState('')
  const [best, setBest] = useState<Record<string, number>>(loadBest)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextTickRef = useRef(0)
  const beatRef     = useRef(0)
  const endAtRef    = useRef(0)
  const activeIdxRef = useRef(0)
  const listRef = useRef(list)
  const bpcRef  = useRef(beatsPerChange)
  useEffect(() => { listRef.current = list }, [list])
  useEffect(() => { bpcRef.current = beatsPerChange }, [beatsPerChange])

  const stop = useCallback((done: boolean) => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    setRunning(false)
    if (done) { setFinished(true); setScoreInput('') }
  }, [])

  const tick = useCallback(() => {
    const ctx = audioEngine.getContext()
    if (ctx.currentTime >= endAtRef.current) { stop(true); return }
    setTimeLeft(Math.max(0, Math.ceil(endAtRef.current - ctx.currentTime)))
    while (nextTickRef.current < ctx.currentTime + 0.1) {
      const beat = beatRef.current
      scheduleClick(ctx, nextTickRef.current, beat % bpcRef.current === 0)
      if (beat > 0 && beat % bpcRef.current === 0) {
        // 换和弦：随机挑一个与当前不同的
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
    endAtRef.current = ctx.currentTime + DURATION_S
    setTimeLeft(DURATION_S)
    setRunning(true)
    intervalRef.current = setInterval(tick, 25)
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  function addCurrent() {
    const c = { root: currentRoot, suffix: currentSuffix }
    if (list.some(x => x.root === c.root && x.suffix === c.suffix) || list.length >= 4) return
    setList([...list, c])
  }

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

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900/60 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800/60"
      >
        <span className="font-medium">⏱ 和弦转换练习</span>
        <span className="text-zinc-500 text-xs">{open ? '收起 ▲' : '展开 ▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            选 2–4 个和弦，节拍器每 {beatsPerChange} 拍随机切换目标和弦，跟着按。60 秒后数一数完成了几次干净转换。
          </p>

          {/* 和弦列表 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {list.map((c, i) => (
              <span key={i} className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 text-xs text-zinc-200">
                {chordName(c)}
                <button
                  onClick={() => setList(list.filter((_, j) => j !== i))}
                  aria-label={`移除 ${chordName(c)}`}
                  className="text-zinc-500 hover:text-red-400"
                >✕</button>
              </span>
            ))}
            <button
              onClick={addCurrent}
              disabled={running || list.length >= 4}
              className="px-2 py-1 rounded-md border border-dashed border-zinc-600 text-xs text-zinc-400 hover:text-amber-400 hover:border-amber-500/50 disabled:opacity-40"
            >
              + 加入 {currentRoot}{currentSuffix === 'major' ? '' : currentSuffix === 'minor' ? 'm' : ' ' + prettifySuffix(currentSuffix)}
            </button>
          </div>

          {/* 参数 */}
          <div className="flex items-center gap-3 text-xs text-zinc-400 flex-wrap">
            <label className="flex items-center gap-1.5">
              速度
              <input
                type="number" min={30} max={160} value={bpm} disabled={running}
                onChange={e => setBpm(Math.max(30, Math.min(160, Number(e.target.value) || 60)))}
                className="w-14 bg-zinc-800 text-zinc-200 rounded-md px-1.5 py-1 border border-zinc-700 outline-none text-center focus:border-amber-500"
              /> BPM
            </label>
            <label className="flex items-center gap-1.5">
              每
              <select
                value={beatsPerChange} disabled={running}
                onChange={e => setBeatsPerChange(Number(e.target.value))}
                className="bg-zinc-800 text-zinc-200 rounded-md px-1.5 py-1 border border-zinc-700 outline-none"
              >
                <option value={2}>2</option>
                <option value={4}>4</option>
                <option value={8}>8</option>
              </select>
              拍换一次
            </label>
            {bestForList !== undefined && (
              <span className="text-amber-400">历史最佳 {bestForList} 次</span>
            )}
          </div>

          {/* 运行区 */}
          {running && active ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="text-xs text-zinc-500">剩余 {timeLeft} 秒</div>
              <div className="text-4xl font-bold text-amber-400">{chordName(active)}</div>
              {activeEntry?.positions[0] && <ChordDiagram position={activeEntry.positions[0]} lite />}
              <button
                onClick={() => stop(false)}
                className="px-4 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700"
              >提前结束</button>
            </div>
          ) : finished ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="text-sm text-zinc-200">时间到！这一轮完成了多少次转换？</div>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} value={scoreInput}
                  onChange={e => setScoreInput(e.target.value)}
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
              {list.length < 2 ? '至少加入 2 个和弦' : '开始 60 秒练习'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
