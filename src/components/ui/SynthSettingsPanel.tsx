import { useState, useEffect } from 'react'
import {
  getSynthConfig, setSynthConfig, resetSynthConfig, subscribeSynth,
  SYNTH_DEFAULTS,
} from '../../audio/synthConfig'
import type { SynthConfig } from '../../audio/synthConfig'

interface SliderSpec {
  key:   keyof SynthConfig
  label: string
  min:   number
  max:   number
  step:  number
  fmt:   (v: number) => string
}

const GROUPS: { title: string; items: SliderSpec[] }[] = [
  {
    title: '木吉他',
    items: [
      { key: 'acousticLoopA',  label: '环路系数', min: 0.30, max: 0.70,   step: 0.01,   fmt: v => v.toFixed(2) },
      { key: 'acousticDecay',  label: '衰减系数', min: 0.990, max: 0.9999, step: 0.0001, fmt: v => v.toFixed(4) },
    ],
  },
  {
    title: '电吉他全局偏移',
    items: [
      { key: 'elecBrightness',  label: '亮度',   min: -0.25, max: 0.25, step: 0.01,   fmt: v => (v >= 0 ? '+' : '') + v.toFixed(2) },
      { key: 'elecDecayOffset', label: '延音',   min: -0.003, max: 0.003, step: 0.0001, fmt: v => (v >= 0 ? '+' : '') + v.toFixed(4) },
    ],
  },
  {
    title: '效果',
    items: [
      { key: 'overdriveDrive',  label: '过载强度', min: 0,    max: 0.65,  step: 0.01, fmt: v => v.toFixed(2) },
      { key: 'overdriveLp',     label: '过载截频', min: 1000, max: 12000, step: 100,  fmt: v => v + ' Hz' },
      { key: 'distortionDrive', label: '失真强度', min: 0.5,  max: 1.0,   step: 0.01, fmt: v => v.toFixed(2) },
      { key: 'distortionLp',    label: '失真截频', min: 500,  max: 8000,  step: 100,  fmt: v => v + ' Hz' },
    ],
  },
  {
    title: '音符时长',
    items: [
      { key: 'durAcoustic',    label: '木吉他', min: 0.5, max: 4.0, step: 0.1, fmt: v => v.toFixed(1) + 's' },
      { key: 'durClean',       label: '电·清音', min: 0.5, max: 4.0, step: 0.1, fmt: v => v.toFixed(1) + 's' },
      { key: 'durOverdrive',   label: '过载',   min: 0.2, max: 3.0, step: 0.1, fmt: v => v.toFixed(1) + 's' },
      { key: 'durDistortion',  label: '失真',   min: 0.1, max: 2.0, step: 0.1, fmt: v => v.toFixed(1) + 's' },
    ],
  },
  {
    title: 'KS 合成',
    items: [
      { key: 'exciteSmooth', label: '激励平滑', min: 0,   max: 0.90, step: 0.01, fmt: v => v.toFixed(2) },
      { key: 'fadeOutStart', label: '淡出起点', min: 0.3, max: 0.99, step: 0.01, fmt: v => Math.round(v * 100) + '%' },
    ],
  },
]

function isDefault(cfg: SynthConfig): boolean {
  return (Object.keys(SYNTH_DEFAULTS) as (keyof SynthConfig)[]).every(
    k => Math.abs((cfg[k] as number) - (SYNTH_DEFAULTS[k] as number)) < 1e-9
  )
}

export default function SynthSettingsPanel() {
  const [cfg, setCfg] = useState<SynthConfig>(getSynthConfig)
  const [open, setOpen] = useState(false)

  useEffect(() => subscribeSynth(() => setCfg(getSynthConfig())), [])

  function handleChange(key: keyof SynthConfig, raw: string) {
    const v = parseFloat(raw)
    if (!isNaN(v)) setSynthConfig({ [key]: v })
  }

  const atDefault = isDefault(cfg)

  return (
    <div className="border-t border-zinc-800 pt-3">
      {/* Toggle row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <span>高级合成参数</span>
        <span className="flex items-center gap-2">
          {!atDefault && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px]">已修改</span>
          )}
          <span className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {GROUPS.map(group => (
            <div key={group.title}>
              <div className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium mb-2">
                {group.title}
              </div>
              <div className="space-y-2">
                {group.items.map(spec => (
                  <div key={spec.key} className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400 w-20 shrink-0">{spec.label}</span>
                    <input
                      type="range"
                      min={spec.min}
                      max={spec.max}
                      step={spec.step}
                      value={cfg[spec.key] as number}
                      onChange={e => handleChange(spec.key, e.target.value)}
                      className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer
                        bg-zinc-700 accent-amber-500"
                    />
                    <span className="text-xs font-mono text-zinc-300 w-14 text-right shrink-0">
                      {spec.fmt(cfg[spec.key] as number)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={resetSynthConfig}
            disabled={atDefault}
            className={`w-full py-2 rounded-xl text-xs font-medium border transition-colors ${
              atDefault
                ? 'border-zinc-800 text-zinc-600 cursor-not-allowed'
                : 'border-zinc-600 text-zinc-300 hover:border-zinc-400 hover:text-zinc-100'
            }`}
          >
            恢复默认值
          </button>
        </div>
      )}
    </div>
  )
}
