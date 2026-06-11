import { IconMic, IconMusic, IconGrid, IconSequencer } from '../ui/icons'

type Tab = 'recognize' | 'browse' | 'fretboard' | 'compose'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

const TABS: { id: Tab; label: string; Icon: (p: { className?: string }) => JSX.Element }[] = [
  { id: 'recognize', label: '识别',  Icon: IconMic },
  { id: 'browse',    label: '和弦',  Icon: IconMusic },
  { id: 'fretboard', label: '指板',  Icon: IconGrid },
  { id: 'compose',   label: '编曲',  Icon: IconSequencer },
]

export default function TabBar({ active, onChange }: Props) {
  return (
    <div className="flex bg-white/80 backdrop-blur-md border-b border-amber-200/60 relative z-10">
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors ${
              isActive
                ? 'text-amber-600 border-b-2 border-amber-500'
                : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        )
      })}
    </div>
  )
}

export type { Tab }
