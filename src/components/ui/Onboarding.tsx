import { useState } from 'react'

// 首次访问的功能引导。看过一次后不再出现（localStorage）。
const SEEN_KEY = 'guitar-chord-onboarded'

const STEPS = [
  { icon: '🎤', title: '识别', body: '弹一个和弦用麦克风识别，或在指板上点出按法反查和弦名。' },
  { icon: '🎵', title: '和弦', body: '查任意和弦的多种指法、试听伴奏，还能做 60 秒和弦转换练习。' },
  { icon: '🎸', title: '指板', body: '按调性高亮音阶，点击发声，横竖两种视图，支持多种调弦。' },
  { icon: '🎹', title: '编曲', body: '排和弦与旋律、扫弦节奏型、变调夹、区间循环练习，或让 AI 帮你写。' },
]

export function hasOnboarded(): boolean {
  try { return localStorage.getItem(SEEN_KEY) === '1' } catch { return true }
}

export default function Onboarding({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const cur = STEPS[step]
  const last = step === STEPS.length - 1

  function finish() {
    try { localStorage.setItem(SEEN_KEY, '1') } catch { /* ignore */ }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-6">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center text-center gap-3">
        <div className="text-4xl">{cur.icon}</div>
        <div className="text-lg font-semibold text-amber-400">{cur.title}</div>
        <p className="text-sm text-zinc-300 leading-relaxed">{cur.body}</p>

        <div className="flex gap-1.5 mt-1">
          {STEPS.map((_, i) => (
            <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === step ? 'bg-amber-400' : 'bg-zinc-700'}`} />
          ))}
        </div>

        <div className="flex gap-2 mt-3 w-full">
          <button
            onClick={finish}
            className="flex-1 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-sm hover:bg-zinc-700"
          >跳过</button>
          <button
            onClick={() => (last ? finish() : setStep(step + 1))}
            className="flex-1 py-2 rounded-xl bg-amber-500 text-zinc-950 text-sm font-semibold hover:bg-amber-400"
          >{last ? '开始使用' : '下一个'}</button>
        </div>
      </div>
    </div>
  )
}
