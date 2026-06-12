import { useState, useEffect } from 'react'
import {
  getToneConfig, setToneConfig, subscribeTone, validPositions,
  POS_LABEL,
} from '../../audio/toneConfig'
import type { PickupConfig, PickupType, EffectType } from '../../audio/toneConfig'
import { IconX } from './icons'

interface Props {
  onClose: () => void
}

function SegBtn<T extends string>({
  value, options, onChange,
}: {
  value: T
  options: { val: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-zinc-700">
      {options.map(o => (
        <button
          key={o.val}
          onClick={() => onChange(o.val)}
          className={`px-2.5 py-1.5 text-xs transition-colors ${
            value === o.val
              ? 'bg-amber-500 text-zinc-950 font-semibold'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const PICKUP_OPTIONS: { val: PickupType; label: string }[] = [
  { val: null, label: '关' },
  { val: 'S',  label: '单' },
  { val: 'H',  label: '双' },
]

const EFFECT_OPTIONS: { val: EffectType; label: string }[] = [
  { val: 'clean',      label: '清音' },
  { val: 'overdrive',  label: '过载' },
  { val: 'distortion', label: '失真' },
]

export default function TonePanel({ onClose }: Props) {
  const [cfg, setCfg] = useState<PickupConfig>(getToneConfig)

  useEffect(() => subscribeTone(() => setCfg(getToneConfig())), [])

  function patch(p: Partial<PickupConfig>) {
    setToneConfig(p)
  }

  const positions = validPositions(cfg)

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 rounded-t-2xl border-t border-zinc-700 px-4 pt-3 pb-6 space-y-4 tone-panel-enter max-w-lg mx-auto">

        {/* Drag handle + title */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-100">音色设置</span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <IconX />
          </button>
        </div>

        {/* Mode */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 shrink-0">模式</span>
          <SegBtn
            value={cfg.mode}
            options={[
              { val: 'acoustic', label: '木吉他' },
              { val: 'electric', label: '电吉他' },
            ]}
            onChange={v => patch({ mode: v })}
          />
        </div>

        {cfg.mode === 'electric' && (
          <>
            {/* Pickup slots */}
            <div className="space-y-2">
              <span className="text-xs text-zinc-500 block">拾音器</span>
              {(
                [
                  { label: '桥', key: 'bridge' },
                  { label: '中', key: 'middle' },
                  { label: '颈', key: 'neck' },
                ] as const
              ).map(({ label, key }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 w-4 shrink-0">{label}</span>
                  <SegBtn
                    value={cfg[key] as PickupType ?? null}
                    options={PICKUP_OPTIONS}
                    onChange={(v: PickupType) => patch({ [key]: v })}
                  />
                </div>
              ))}
            </div>

            {/* Position selector */}
            <div className="space-y-1.5">
              <span className="text-xs text-zinc-500 block">拾音位置</span>
              <div className="flex flex-wrap gap-1.5">
                {positions.map(pos => (
                  <button
                    key={pos}
                    onClick={() => patch({ position: pos })}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                      cfg.position === pos
                        ? 'border-amber-400 bg-amber-400/10 text-amber-300 font-semibold'
                        : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500'
                    }`}
                  >
                    {POS_LABEL[pos]}
                  </button>
                ))}
              </div>
            </div>

            {/* Effect */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 shrink-0">效果</span>
              <SegBtn
                value={cfg.effect}
                options={EFFECT_OPTIONS}
                onChange={v => patch({ effect: v })}
              />
            </div>
          </>
        )}
      </div>
    </>
  )
}
