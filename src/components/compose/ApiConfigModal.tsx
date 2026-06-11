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

  const labelClass = 'text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-1.5 block'
  const inputClass = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30'

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full bg-zinc-900 border-t border-zinc-700/60 rounded-t-2xl p-5 pb-10 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <span className="text-sm font-semibold text-zinc-200">API 配置</span>
          <button onClick={onClose} className="text-zinc-500 text-xs hover:text-zinc-300">取消</button>
        </div>

        <div className="mb-4">
          <label className={labelClass}>供应商</label>
          <div className="flex gap-2">
            {(['openai', 'anthropic'] as const).map(p => (
              <button
                key={p}
                onClick={() => switchProvider(p)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                  cfg.provider === p
                    ? 'bg-amber-500 text-zinc-950'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
                }`}
              >
                {p === 'openai' ? 'OpenAI 兼容' : 'Anthropic'}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <label className={labelClass}>API Key</label>
          <input
            type="password"
            value={cfg.apiKey}
            onChange={e => update({ apiKey: e.target.value })}
            placeholder="sk-..."
            className={inputClass}
          />
        </div>

        {cfg.provider === 'openai' && (
          <div className="mb-3">
            <label className={labelClass}>
              Base URL
              <span className="ml-1 normal-case text-zinc-600 font-normal">（可改为兼容代理）</span>
            </label>
            <input type="text" value={cfg.baseUrl} onChange={e => update({ baseUrl: e.target.value })} className={inputClass} />
          </div>
        )}

        <div className="mb-6">
          <label className={labelClass}>模型</label>
          <input type="text" value={cfg.model} onChange={e => update({ model: e.target.value })} className={inputClass} />
        </div>

        <button
          onClick={handleSave}
          className="w-full py-3 rounded-xl bg-amber-500 text-zinc-950 font-semibold text-sm hover:bg-amber-400"
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
