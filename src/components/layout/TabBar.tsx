type Tab = 'recognize' | 'browse' | 'fretboard'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'recognize', label: '🎵 声音识别' },
  { id: 'browse',    label: '🎼 和弦浏览' },
  { id: 'fretboard', label: '🎸 指板音名' },
]

export default function TabBar({ active, onChange }: Props) {
  return (
    <div className="flex bg-zinc-900 border-b border-zinc-800">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            active === id
              ? 'text-amber-400 border-b-2 border-amber-400'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export type { Tab }
