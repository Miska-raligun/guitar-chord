import { useState } from 'react'
import { useAiCompose } from '../../hooks/useAiCompose'
import ApiConfigModal, { loadApiConfig } from './ApiConfigModal'
import { IconWand, IconSettings } from '../ui/icons'
import type { AiComposition } from '../../hooks/useAiCompose'

interface Props {
  onGenerate: (result: AiComposition) => void
  onClose: () => void
}

const ROOT_NAMES = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B']
const PATTERN_LABELS: Record<string, string> = {
  '53231323': '民谣', 'x3231323': '切音', '3_12_3': '古典', 'strum': '扫弦',
}

export default function AiPanel({ onGenerate, onClose }: Props) {
  const [prompt, setPrompt]         = useState('')
  const [result, setResult]         = useState<AiComposition | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const { generate, isLoading, error, clearError } = useAiCompose()

  if (showConfig) return <ApiConfigModal onClose={() => setShowConfig(false)} />

  async function handleGenerate() {
    if (!prompt.trim()) return
    const config = loadApiConfig()
    const r = await generate(prompt, config)
    if (r) setResult(r)
  }

  const melodyCount = result ? result.melody.flat().filter(Boolean).length : 0

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-zinc-900 border-t border-zinc-700/60 rounded-t-2xl p-4 pb-8 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <IconWand className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-zinc-100">AI 创作</span>
          </div>
          <div className="flex items-center gap-3">
            {!result && (
              <button
                onClick={() => setShowConfig(true)}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
              >
                <IconSettings className="w-3.5 h-3.5" />
                API 配置
              </button>
            )}
            <button onClick={onClose} className="text-zinc-500 text-xs hover:text-zinc-300">关闭</button>
          </div>
        </div>

        {result ? (
          /* ── Preview ── */
          <div>
            {/* Prompt echo */}
            <p className="text-[11px] text-zinc-500 italic mb-2.5 line-clamp-1">"{prompt}"</p>

            {/* Summary tags */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {[
                ROOT_NAMES[result.keyRoot] + ' 调',
                result.timeSig,
                PATTERN_LABELS[result.pattern] ?? result.pattern,
                result.bpm + ' BPM',
                ...(melodyCount > 0 ? ['旋律 ' + melodyCount + ' 音'] : []),
              ].map(tag => (
                <span key={tag} className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-medium">
                  {tag}
                </span>
              ))}
            </div>

            {/* Chord preview grid */}
            <div className="grid grid-cols-4 gap-1.5 mb-4">
              {result.chords.map((slot, i) => (
                <div
                  key={i}
                  className={`h-11 rounded-xl flex flex-col items-center justify-center text-xs font-medium border ${
                    slot.root
                      ? 'bg-zinc-800 border-zinc-600 text-zinc-100'
                      : 'bg-zinc-800/40 border-dashed border-zinc-700 text-zinc-600'
                  }`}
                >
                  {slot.root ? (
                    <>
                      <span className="leading-none">{slot.root}</span>
                      {slot.suffix && slot.suffix !== 'major' && (
                        <span className="text-[9px] text-amber-400 leading-tight mt-0.5">{slot.suffix}</span>
                      )}
                    </>
                  ) : (
                    <span>—</span>
                  )}
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => { setResult(null); clearError() }}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700"
              >
                重新生成
              </button>
              <button
                onClick={() => { onGenerate(result); setResult(null) }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-semibold text-sm hover:bg-amber-400"
              >
                ✓ 应用到编曲
              </button>
            </div>
          </div>
        ) : (
          /* ── Input ── */
          <div>
            <textarea
              value={prompt}
              onChange={e => { setPrompt(e.target.value); clearError() }}
              placeholder="描述你想要的风格，例如：C 大调舒缓民谣，BPM 70，带旋律...&#10;也可指定拍号：6/8 拍圆舞曲、3/4 拍爵士..."
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 resize-none mb-3 placeholder:text-zinc-600"
            />

            {error && (
              <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/30 rounded-xl px-3 py-2 mb-3 leading-relaxed">
                {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={isLoading || !prompt.trim()}
              className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 ${
                isLoading || !prompt.trim()
                  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                  : 'bg-amber-500 text-zinc-950 hover:bg-amber-400'
              }`}
            >
              <IconWand className="w-4 h-4" />
              {isLoading ? '生成中...' : '生成编曲'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
