import { useState } from 'react'
import { useAiCompose } from '../../hooks/useAiCompose'
import ApiConfigModal, { loadApiConfig } from './ApiConfigModal'
import { IconWand, IconSettings } from '../ui/icons'
import type { AiComposition } from '../../hooks/useAiCompose'

interface Props {
  onGenerate: (result: AiComposition) => void
  onClose: () => void
}

export default function AiPanel({ onGenerate, onClose }: Props) {
  const [prompt, setPrompt]         = useState('')
  const [showConfig, setShowConfig] = useState(false)
  const { generate, isLoading, error, clearError } = useAiCompose()

  async function handleGenerate() {
    if (!prompt.trim()) return
    const config = loadApiConfig()
    const result = await generate(prompt, config)
    if (result) onGenerate(result)
  }

  if (showConfig) {
    return <ApiConfigModal onClose={() => setShowConfig(false)} />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-white border-t border-amber-200 rounded-t-2xl p-4 pb-8 shadow-xl shadow-amber-200/30"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <IconWand className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-stone-800">AI 创作</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowConfig(true)}
              className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600"
            >
              <IconSettings className="w-3.5 h-3.5" />
              API 配置
            </button>
            <button onClick={onClose} className="text-stone-400 text-xs hover:text-stone-600">关闭</button>
          </div>
        </div>

        <textarea
          value={prompt}
          onChange={e => { setPrompt(e.target.value); clearError() }}
          placeholder="描述你想要的风格，例如：C 大调舒缓民谣，BPM 70，带旋律..."
          rows={3}
          className="w-full bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-300/40 resize-none mb-3 placeholder:text-stone-400"
        />

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3 leading-relaxed">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={isLoading || !prompt.trim()}
          className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 ${
            isLoading || !prompt.trim()
              ? 'bg-amber-100 text-stone-400 cursor-not-allowed'
              : 'bg-amber-500 text-stone-50 hover:bg-amber-600'
          }`}
        >
          <IconWand className="w-4 h-4" />
          {isLoading ? '生成中...' : '生成编曲'}
        </button>
      </div>
    </div>
  )
}
