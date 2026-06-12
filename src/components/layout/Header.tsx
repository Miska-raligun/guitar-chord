import { useState, useEffect } from 'react'
import { IconGuitar, IconElectric } from '../ui/icons'
import { getToneConfig, subscribeTone } from '../../audio/toneConfig'
import TonePanel from '../ui/TonePanel'

export default function Header() {
  const [panelOpen, setPanelOpen] = useState(false)
  const [isElectric, setIsElectric] = useState(() => getToneConfig().mode === 'electric')

  useEffect(() => subscribeTone(() => {
    setIsElectric(getToneConfig().mode === 'electric')
  }), [])

  return (
    <>
      <header className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <span className="grid place-items-center h-8 w-8 rounded-lg bg-amber-500/15 text-amber-400 shrink-0">
          <IconGuitar className="w-4 h-4" />
        </span>
        <h1 className="text-base font-semibold tracking-tight text-zinc-100 flex-1">吉他和弦练习</h1>

        <button
          onClick={() => setPanelOpen(o => !o)}
          title="音色设置"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            isElectric
              ? 'border-amber-500/60 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15'
              : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
          }`}
        >
          <IconElectric className="w-3.5 h-3.5" />
          <span>{isElectric ? '电吉他' : '木吉他'}</span>
        </button>
      </header>

      {panelOpen && <TonePanel onClose={() => setPanelOpen(false)} />}
    </>
  )
}
