import { useState } from 'react'
import { useAiCompose } from '../../hooks/useAiCompose'
import ApiConfigModal, { loadApiConfig } from './ApiConfigModal'
import type { AiComposition } from '../../hooks/useAiCompose'

interface Props {
  onGenerate: (result: AiComposition) => void
  onClose: () => void
}

export default function AiPanel({ onGenerate, onClose }: Props) {
  const [prompt, setPrompt]       = useState('')
  const [showConfig, setShowConfig] = useState(false)
  const { generate, isLoading, error, clearError } = useAiCompose()

  async function handleGenerate() {
    if (!prompt.trim()) return
    const config = loadApiConfig()
    const result = await generate(prompt, config)
    if (result) {
      onGenerate(result)
      onClose()
    }
  }

  if (showConfig) {
    return <ApiConfigModal onClose={() => setShowConfig(false)} />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-zinc-900 border-t border-zinc-700 rounded-t-2xl p-4 pb-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-zinc-200">🤖 AI 创作</span>
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfig(true)}
              className="text-xs text-amber-400 hover:text-amber-300"
            >
              配置 API
            </button>
            <button onClick={onClose} className="text-zinc-500 text-sm hover:text-zinc-300">关闭</button>
          </div>
        </div>

        <textarea
          value={prompt}
          onChange={e => { setPrompt(e.target.value); clearError() }}
          placeholder="描述你想要的编曲风格，例如：给我一段 C 大调舒缓民谣，BPM 70 左右，带一点旋律..."
          rows={4}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-amber-500 resize-none mb-3"
        />

        {error && (
          <div className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2 mb-3">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={isLoading || !prompt.trim()}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${
            isLoading || !prompt.trim()
              ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
              : 'bg-amber-500 text-zinc-950 hover:bg-amber-400'
          }`}
        >
          {isLoading ? '生成中...' : '✨ 生成编曲'}
        </button>
      </div>
    </div>
  )
}
