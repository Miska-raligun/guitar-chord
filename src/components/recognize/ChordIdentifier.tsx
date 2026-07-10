import { useState } from 'react'
import { pluckStringAt } from '../../audio/karplusStrong'
import audioEngine from '../../audio/AudioEngine'
import { identifyChord } from '../../utils/chordIdentify'
import { prettifySuffix } from '../../utils/dbUtils'
import { NOTE_NAMES } from '../../utils/noteUtils'
import { OPEN_STRING_FREQS } from '../../types/chord'
import { useChordDb } from '../../hooks/useChordDb'
import { viewChordInBrowse, addChordToCompose } from '../../utils/appBus'

// 竖向和弦指法图输入：从左到右 = ⑥低音E … ①高音e（与常见和弦图一致）
const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e']   // index 0=低音E … 5=高音e
const WIN = 5           // 一次显示 5 品
const CELL = 46         // 每格边长(px)
const MAX_BASE = 8      // 把位最高从第 8 品起（可见到 12 品）
const INLAY = new Set([3, 5, 7, 9, 12])   // 品位记号

export default function ChordIdentifier() {
  // frets[i]：该弦所按品位（0=空弦），null=闷弦
  const [frets, setFrets] = useState<(number | null)[]>([null, null, null, null, null, null])
  const [baseFret, setBaseFret] = useState(1)
  const [added, setAdded] = useState(false)
  const { getChordEntry } = useChordDb()

  function playString(i: number, f: number) {
    audioEngine.resume()
    const ctx = audioEngine.getContext()
    pluckStringAt(OPEN_STRING_FREQS[i] * Math.pow(2, f / 12), ctx.currentTime + 0.01, 0.6)
  }

  // 点击品格：设/取消该弦的品位
  function pickFret(i: number, f: number) {
    setFrets(prev => {
      const next = [...prev]
      next[i] = prev[i] === f ? null : f
      return next
    })
    if (frets[i] !== f) playString(i, f)
  }

  // 点击顶部标记：闷弦 ↔ 空弦
  function toggleTop(i: number) {
    setFrets(prev => {
      const next = [...prev]
      next[i] = prev[i] === null ? 0 : null
      return next
    })
    if (frets[i] === null) playString(i, 0)
  }

  const result = identifyChord(frets)
  const shape = frets.map(f => (f === null ? 'x' : String(f))).join(' ')
  const anySelected = frets.some(f => f !== null)

  // 识别成功且该和弦在指法库里有数据时，提供"查看指法 / 加入编曲"联动
  const chordRef = (result.name && !result.isSingleNote && result.root !== null && result.suffix)
    ? { root: NOTE_NAMES[result.root], suffix: result.suffix }
    : null
  const linkable = chordRef !== null && getChordEntry(chordRef.root, chordRef.suffix) !== null

  function handleAddToCompose() {
    if (!chordRef) return
    addChordToCompose(chordRef)
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  const boardW = CELL * 6
  const rows = Array.from({ length: WIN }, (_, r) => baseFret + r)   // 每行对应的绝对品位

  return (
    <div className="w-full flex flex-col items-center gap-4">
      {/* 把位控制 */}
      <div className="flex items-center gap-3 text-xs text-zinc-400">
        <span>把位</span>
        <button
          onClick={() => setBaseFret(b => Math.max(1, b - 1))}
          disabled={baseFret <= 1}
          className="w-7 h-7 rounded-md bg-zinc-800 text-zinc-300 disabled:opacity-30 hover:bg-zinc-700"
        >−</button>
        <span className="w-14 text-center text-zinc-200">第 {baseFret} 品起</span>
        <button
          onClick={() => setBaseFret(b => Math.min(MAX_BASE, b + 1))}
          disabled={baseFret >= MAX_BASE}
          className="w-7 h-7 rounded-md bg-zinc-800 text-zinc-300 disabled:opacity-30 hover:bg-zinc-700"
        >+</button>
      </div>

      {/* 指法图 */}
      <div className="flex">
        {/* 左侧品位编号 */}
        <div className="flex flex-col">
          <div style={{ height: CELL * 0.6 }} />
          {rows.map(fr => (
            <div key={fr} style={{ height: CELL }} className="w-6 flex items-center justify-end pr-1 text-[11px] text-zinc-500 font-mono">
              {fr}
            </div>
          ))}
        </div>

        <div>
          {/* 顶部 开放/闷弦 标记 */}
          <div className="grid grid-cols-6" style={{ width: boardW, height: CELL * 0.6 }}>
            {STRING_NAMES.map((_, s) => {
              const f = frets[s]
              const outOfWindow = f !== null && f > 0 && (f < baseFret || f >= baseFret + WIN)
              const label = f === null ? '✕' : f === 0 ? '○' : outOfWindow ? String(f) : ''
              const cls = f === null ? 'text-zinc-600' : f === 0 ? 'text-amber-400' : 'text-amber-400'
              return (
                <button
                  key={s}
                  onClick={() => toggleTop(s)}
                  title={f === null ? '闷弦（点击改为空弦）' : '点击闷弦'}
                  className={`flex items-center justify-center text-sm font-bold hover:text-zinc-200 ${cls}`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* 品格区 */}
          <div
            className={`relative ${baseFret === 1 ? 'border-t-[3px] border-zinc-300' : 'border-t border-zinc-600'}`}
            style={{ width: boardW }}
          >
            {rows.map((fr, r) => (
              <div key={fr} className="grid grid-cols-6 border-b border-zinc-700" style={{ height: CELL }}>
                {STRING_NAMES.map((_, s) => {
                  const active = frets[s] === fr
                  return (
                    <button
                      key={s}
                      onClick={() => pickFret(s, fr)}
                      className="relative flex items-center justify-center hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* 弦（竖线） */}
                      <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-zinc-600" />
                      {/* 品位记号（中间弦位置淡显） */}
                      {!active && INLAY.has(fr) && s === 2 && (
                        <span className="absolute right-0 translate-x-1/2 w-1.5 h-1.5 rounded-full bg-zinc-700" />
                      )}
                      {/* 按弦点 */}
                      {active && (
                        <span className="relative z-10 w-7 h-7 rounded-full bg-amber-500 shadow" />
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* 弦名 */}
          <div className="grid grid-cols-6" style={{ width: boardW }}>
            {STRING_NAMES.map((n, s) => (
              <div key={s} className="text-center text-[11px] text-zinc-500 font-mono pt-1">{n}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="text-[10px] text-zinc-600 text-center">点击品格按弦 · 点顶部 ○/✕ 切换空弦/闷弦 · 用把位按钮上下移动</div>

      {/* 结果 */}
      <div className="w-full max-w-md flex flex-col items-center gap-2 min-h-[7rem] justify-center rounded-xl bg-zinc-800/40 border border-zinc-700 py-5 px-4">
        {!anySelected ? (
          <div className="text-zinc-600 text-sm text-center">在上方指法图上选择你按住的位置<br />下方会显示这是什么和弦</div>
        ) : result.name ? (
          <>
            <div className="text-3xl font-bold text-amber-400 leading-none">{result.name}</div>
            {result.isSingleNote ? (
              <div className="text-xs text-zinc-500">单音</div>
            ) : result.suffix ? (
              <div className="text-xs text-zinc-400">{prettifySuffix(result.suffix)}{result.isSlash ? ' · 转位/分数和弦' : ''}</div>
            ) : null}
            <div className="text-[11px] text-zinc-500 font-mono mt-1">{result.notes.map(pc => NOTE_NAMES[pc]).join(' ')} · [{shape}]</div>
            {result.candidates.length > 0 && (
              <div className="text-[11px] text-zinc-500 mt-1 text-center">
                也可看作：{result.candidates.slice(0, 3).map(c => c.name).join('、')}
              </div>
            )}
            {linkable && chordRef && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => viewChordInBrowse(chordRef)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700 hover:text-amber-400"
                >
                  查看指法
                </button>
                <button
                  onClick={handleAddToCompose}
                  className={`px-3 py-1.5 rounded-lg text-xs ${
                    added
                      ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-amber-400'
                  }`}
                >
                  {added ? '✓ 已加入' : '加入编曲'}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-xl font-semibold text-zinc-300">未知和弦</div>
            <div className="text-[11px] text-zinc-500 font-mono">{result.notes.map(pc => NOTE_NAMES[pc]).join(' ')} · [{shape}]</div>
            <div className="text-[11px] text-zinc-600">这些音不构成常见和弦</div>
          </>
        )}
      </div>

      {anySelected && (
        <button
          onClick={() => { setFrets([null, null, null, null, null, null]); setBaseFret(1) }}
          className="self-center px-4 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-xs hover:bg-zinc-700 hover:text-zinc-200"
        >
          清空
        </button>
      )}
    </div>
  )
}
