import { useState } from 'react'
import { pluckStringAt } from '../../audio/karplusStrong'
import audioEngine from '../../audio/AudioEngine'
import { identifyChord } from '../../utils/chordIdentify'
import { prettifySuffix } from '../../utils/dbUtils'
import { NOTE_NAMES } from '../../utils/noteUtils'
import { OPEN_STRING_FREQS } from '../../types/chord'

const MAX_FRET = 12
const STRING_LABELS = ['⑥', '⑤', '④', '③', '②', '①']   // index 0=低音E … 5=高音e
const STRING_NAMES  = ['E', 'A', 'D', 'G', 'B', 'e']
const DISPLAY_ORDER = [5, 4, 3, 2, 1, 0]                // 高音e在上 → 低音E在下（贴近六线谱）
const SINGLE_DOTS = new Set([3, 5, 7, 9])
const DOUBLE_DOTS = new Set([12])

export default function ChordIdentifier() {
  const [frets, setFrets] = useState<(number | null)[]>([null, null, null, null, null, null])

  function playString(i: number, f: number) {
    audioEngine.resume()
    const ctx = audioEngine.getContext()
    pluckStringAt(OPEN_STRING_FREQS[i] * Math.pow(2, f / 12), ctx.currentTime + 0.01, 0.6)
  }

  function pickFret(i: number, f: number) {
    setFrets(prev => {
      const next = [...prev]
      next[i] = prev[i] === f ? null : f   // 再点一次同品 → 闷弦
      return next
    })
    if (frets[i] !== f) playString(i, f)
  }

  function toggleMute(i: number) {
    setFrets(prev => {
      const next = [...prev]
      next[i] = prev[i] === null ? 0 : null   // 闷 ↔ 空弦
      return next
    })
    if (frets[i] === null) playString(i, 0)
  }

  const result = identifyChord(frets)
  const shape = frets.map(f => (f === null ? 'x' : String(f))).join(' ')   // 低→高
  const anySelected = frets.some(f => f !== null)

  return (
    <div className="w-full max-w-md flex flex-col gap-4">
      {/* 指板输入 */}
      <div className="rounded-xl overflow-hidden border border-zinc-700">
        <div className="overflow-x-auto scrollbar-none">
          <div className="flex flex-col w-full" style={{ minWidth: 'max-content' }}>

            {/* 品位编号行 */}
            <div className="flex border-b-[3px] border-zinc-400 bg-zinc-900">
              <div className="sticky left-0 z-10 w-10 flex-shrink-0 bg-zinc-900 border-r border-zinc-700" />
              {Array.from({ length: MAX_FRET + 1 }, (_, f) => (
                <div key={f} className="flex-1 min-w-[2.2rem] h-7 flex flex-col items-center justify-center gap-[1px]">
                  <span className="text-[9px] text-zinc-500 leading-none">{f === 0 ? '空' : f}</span>
                  {DOUBLE_DOTS.has(f) && <span className="text-[5px] text-amber-400/70 leading-none">●●</span>}
                  {SINGLE_DOTS.has(f) && <span className="text-[5px] text-zinc-600 leading-none">●</span>}
                </div>
              ))}
            </div>

            {/* 弦行：高音e在上 → 低音E在下 */}
            {DISPLAY_ORDER.map((si, rowIdx) => {
              const cur = frets[si]
              const muted = cur === null
              return (
                <div key={si} className={`flex ${rowIdx < DISPLAY_ORDER.length - 1 ? 'border-b border-zinc-800' : ''}`}>
                  {/* 弦标签 / 闷弦按钮 */}
                  <button
                    onClick={() => toggleMute(si)}
                    title={muted ? '闷弦（点按改为空弦）' : '点按闷弦'}
                    className={`sticky left-0 z-10 w-10 flex-shrink-0 flex flex-col items-center justify-center border-r border-zinc-700 transition-colors ${
                      muted ? 'bg-zinc-900 text-zinc-600' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    <span className="text-[11px] font-mono leading-none">{muted ? '✕' : STRING_LABELS[si]}</span>
                    <span className="text-[8px] text-zinc-500 font-mono leading-none mt-0.5">{STRING_NAMES[si]}</span>
                  </button>

                  {Array.from({ length: MAX_FRET + 1 }, (_, f) => {
                    const active = cur === f
                    return (
                      <button
                        key={f}
                        onClick={() => pickFret(si, f)}
                        className={`flex-1 min-w-[2.2rem] h-11 flex items-center justify-center border-l border-zinc-800 select-none transition-colors ${
                          active ? 'bg-amber-500/15' : 'hover:bg-zinc-800'
                        }`}
                      >
                        {active
                          ? <span className="w-5 h-5 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-bold flex items-center justify-center">{f === 0 ? '○' : f}</span>
                          : <span className="w-1.5 h-1.5 rounded-full bg-zinc-800" />}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
        <div className="text-[10px] text-zinc-600 text-center py-1.5 border-t border-zinc-800">
          点击品格选择按法 · 点左侧弦名闷弦/空弦 · 左右滑动查看更多品格
        </div>
      </div>

      {/* 结果 */}
      <div className="flex flex-col items-center gap-2 min-h-[7rem] justify-center rounded-xl bg-zinc-800/40 border border-zinc-700 py-5 px-4">
        {!anySelected ? (
          <div className="text-zinc-600 text-sm text-center">在上方指板上选择你按住的位置<br />下方会显示这是什么和弦</div>
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
          onClick={() => setFrets([null, null, null, null, null, null])}
          className="self-center px-4 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 text-xs hover:bg-zinc-700 hover:text-zinc-200"
        >
          清空
        </button>
      )}
    </div>
  )
}
