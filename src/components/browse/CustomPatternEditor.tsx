import { useState } from 'react'
import type { CustomStepKind, TimeSig } from '../../types/audio'

interface Props {
  steps: CustomStepKind[]
  timeSig: TimeSig
  onStepsChange: (steps: CustomStepKind[]) => void
  onTimeSigChange: (t: TimeSig) => void
}

// 显示顺序：分三区
const STEP_OPTIONS: CustomStepKind[][] = [
  ['根', 'x', '—'],
  ['6', '5', '4', '3', '2', '1', '12'],
  ['↓', '↑'],
]

const STEP_COLORS: Partial<Record<CustomStepKind, string>> = {
  '根': 'text-amber-400',
  'x':  'text-rose-400',
  '—':  'text-zinc-600',
  '↓':  'text-sky-400',
  '↑':  'text-sky-400',
  '12': 'text-violet-400',
}

const MAX_STEPS = 16
const MIN_STEPS = 1

export default function CustomPatternEditor({ steps, timeSig, onStepsChange, onTimeSigChange }: Props) {
  const [editIdx, setEditIdx] = useState<number | null>(null)

  function updateStep(idx: number, kind: CustomStepKind) {
    const next = [...steps]
    next[idx] = kind
    onStepsChange(next)
    setEditIdx(null)
  }

  function addStep() {
    if (steps.length >= MAX_STEPS) return
    onStepsChange([...steps, '—'])
  }

  function removeStep(idx: number) {
    if (steps.length <= MIN_STEPS) return
    const next = steps.filter((_, i) => i !== idx)
    onStepsChange(next)
    if (editIdx !== null && editIdx >= next.length) setEditIdx(null)
  }

  return (
    <div className="space-y-3">
      {/* 拍号选择 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">拍号</span>
        <div className="flex rounded-lg overflow-hidden border border-zinc-700">
          {(['2/4', '3/4', '4/4', '6/8'] as TimeSig[]).map(t => (
            <button
              key={t}
              onClick={() => onTimeSigChange(t)}
              className={`px-2.5 py-1 text-xs font-mono transition-colors ${
                timeSig === t
                  ? 'bg-amber-500 text-zinc-950 font-semibold'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-600 ml-auto">{steps.length} 步</span>
      </div>

      {/* 步骤序列 */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {steps.map((kind, i) => (
          <div key={i} className="relative flex-shrink-0">
            <button
              onClick={() => setEditIdx(editIdx === i ? null : i)}
              className={`w-10 h-10 rounded-lg text-sm font-bold flex flex-col items-center justify-center border transition-colors ${
                editIdx === i
                  ? 'border-amber-400 bg-amber-400/10'
                  : 'border-zinc-700 bg-zinc-800 hover:border-zinc-500'
              } ${STEP_COLORS[kind] ?? 'text-zinc-100'}`}
            >
              {kind}
              <span className="text-[9px] text-zinc-600 font-normal leading-none">{i + 1}</span>
            </button>
            {/* 长按删除：单击小×按钮 */}
            <button
              onClick={() => removeStep(i)}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-zinc-700 text-zinc-400 text-[9px] leading-none flex items-center justify-center hover:bg-red-500 hover:text-white"
            >
              ×
            </button>
          </div>
        ))}

        {/* 添加步骤 */}
        {steps.length < MAX_STEPS && (
          <button
            onClick={addStep}
            className="w-10 h-10 rounded-lg border border-dashed border-zinc-700 text-zinc-500 text-lg flex items-center justify-center hover:border-amber-500 hover:text-amber-500 flex-shrink-0"
          >
            +
          </button>
        )}
      </div>

      {/* 步骤选择器（点击步骤按钮后展开） */}
      {editIdx !== null && (
        <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-700 space-y-2">
          <div className="text-xs text-zinc-500 mb-1">
            选择第 {editIdx + 1} 步 &nbsp;·&nbsp;
            <span className="text-zinc-600">根=根音弦 | 1-6=吉他弦序 | 12=两弦同拨 | ↓↑=扫弦 | —=休止</span>
          </div>

          {STEP_OPTIONS.map((group, gi) => (
            <div key={gi} className="flex flex-wrap gap-1.5">
              {group.map(opt => (
                <button
                  key={opt}
                  onClick={() => updateStep(editIdx, opt)}
                  className={`min-w-[2.5rem] px-2 py-2 rounded-lg text-sm font-bold border transition-colors ${
                    steps[editIdx] === opt
                      ? 'border-amber-400 bg-amber-400/10 ' + (STEP_COLORS[opt] ?? 'text-amber-300')
                      : 'border-zinc-700 bg-zinc-800 hover:border-zinc-500 ' + (STEP_COLORS[opt] ?? 'text-zinc-200')
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
