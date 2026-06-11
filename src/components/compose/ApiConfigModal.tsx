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

  const labelClass = 'text-[10px] text-stone-400 uppercase tracking-wider font-medium mb-1.5 block'
  const inputClass = 'w-full bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-300/40'

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-stone-900/20 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full bg-white border-t border-amber-200 rounded-t-2xl p-5 pb-10 shadow-xl shadow-amber-200/30"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <span className="text-sm font-semibold text-stone-800">API 配置</span>
          <button onClick={onClose} className="text-stone-400 text-xs hover:text-stone-600">取消</button>
        </div>

        <div className="mb-4">
          <label className={labelClass}>供应商</label>
          <div className="flex gap-2">
            {(['openai', 'anthropic'] as const).map(p => (
              <button
                key={p}
                onClick={() => switchProvider(p)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium ${
                  cfg.provider === p
                    ? 'bg-amber-500 text-stone-50'
                    : 'bg-amber-100 text-stone-500 hover:text-stone-700 hover:bg-amber-200'
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

        <div className="mb-3">
          <label className={labelClass}>
            Base URL
            <span className="ml-1 normal-case text-stone-400 font-normal">（可改为第三方代理地址）</span>
          </label>
          <input type="text" value={cfg.baseUrl} onChange={e => update({ baseUrl: e.target.value })} className={inputClass} />
        </div>

        <div className="mb-6">
          <label className={labelClass}>模型</label>
          <input type="text" value={cfg.model} onChange={e => update({ model: e.target.value })} className={inputClass} />
        </div>

        <button
          onClick={handleSave}
          className="w-full py-3 rounded-xl bg-amber-500 text-stone-50 font-semibold text-sm hover:bg-amber-600"
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
