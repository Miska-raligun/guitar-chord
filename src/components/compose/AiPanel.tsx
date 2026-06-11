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
        className="w-full bg-zinc-900 border-t border-zinc-700/60 rounded-t-2xl p-4 pb-8 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <IconWand className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-zinc-200">AI 创作</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowConfig(true)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              <IconSettings className="w-3.5 h-3.5" />
              API 配置
            </button>
            <button onClick={onClose} className="text-zinc-500 text-xs hover:text-zinc-300">关闭</button>
          </div>
        </div>

        <textarea
          value={prompt}
          onChange={e => { setPrompt(e.target.value); clearError() }}
          placeholder="描述你想要的风格，例如：C 大调舒缓民谣，BPM 70，带旋律..."
          rows={3}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-amber-500/50 resize-none mb-3 placeholder:text-zinc-600"
        />

        {error && (
          <div className="text-xs text-red-400 bg-red-400/8 border border-red-400/20 rounded-lg px-3 py-2 mb-3 leading-relaxed">
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
    </div>
  )
}
