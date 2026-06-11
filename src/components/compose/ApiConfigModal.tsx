import { useState } from 'react'
import type { ApiConfig } from '../../types/compose'
import { API_CONFIG_KEY, DEFAULT_ANTHROPIC_CONFIG, DEFAULT_OPENAI_CONFIG } from '../../types/compose'

function loadConfig(): ApiConfig {
  try {
    return JSON.parse(localStorage.getItem(API_CONFIG_KEY) ?? 'null') ?? DEFAULT_OPENAI_CONFIG
  } catch {
    return DEFAULT_OPENAI_CONFIG
  }
}

interface Props {
  onClose: () => void
}

export default function ApiConfigModal({ onClose }: Props) {
  const [cfg, setCfg] = useState<ApiConfig>(loadConfig)

  function update(patch: Partial<ApiConfig>) {
    setCfg(c => ({ ...c, ...patch }))
  }

  function switchProvider(p: 'openai' | 'anthropic') {
    const defaults = p === 'anthropic' ? DEFAULT_ANTHROPIC_CONFIG : DEFAULT_OPENAI_CONFIG
    setCfg(c => ({ ...defaults, apiKey: c.provider === p ? c.apiKey : '' }))
  }

  function handleSave() {
    localStorage.setItem(API_CONFIG_KEY, JSON.stringify(cfg))
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-zinc-900 border-t border-zinc-700 rounded-t-2xl p-5 pb-10"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-zinc-200">API 配置</span>
          <button onClick={onClose} className="text-zinc-500 text-sm hover:text-zinc-300">取消</button>
        </div>

        {/* Provider */}
        <div className="mb-4">
          <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1.5 block">供应商</label>
          <div className="flex gap-2">
            {(['openai', 'anthropic'] as const).map(p => (
              <button
                key={p}
                onClick={() => switchProvider(p)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  cfg.provider === p
                    ? 'bg-amber-500 text-zinc-950'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {p === 'openai' ? 'OpenAI 兼容' : 'Anthropic'}
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div className="mb-3">
          <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1.5 block">API Key</label>
          <input
            type="password"
            value={cfg.apiKey}
            onChange={e => update({ apiKey: e.target.value })}
            placeholder="sk-..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-amber-500"
          />
        </div>

        {/* Base URL (openai only) */}
        {cfg.provider === 'openai' && (
          <div className="mb-3">
            <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1.5 block">
              Base URL <span className="normal-case text-zinc-600">（可改为兼容代理）</span>
            </label>
            <input
              type="text"
              value={cfg.baseUrl}
              onChange={e => update({ baseUrl: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-amber-500"
            />
          </div>
        )}

        {/* Model */}
        <div className="mb-5">
          <label className="text-xs text-zinc-500 uppercase tracking-wider mb-1.5 block">模型</label>
          <input
            type="text"
            value={cfg.model}
            onChange={e => update({ model: e.target.value })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-amber-500"
          />
        </div>

        <button
          onClick={handleSave}
          className="w-full py-3 rounded-xl bg-amber-500 text-zinc-950 font-semibold text-sm hover:bg-amber-400 transition-colors"
        >
          保存配置
        </button>
      </div>
    </div>
  )
}

export function loadApiConfig(): ApiConfig {
  return loadConfig()
}
