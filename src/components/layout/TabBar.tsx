type Tab = 'recognize' | 'browse'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

export default function TabBar({ active, onChange }: Props) {
  return (
    <div className="flex bg-zinc-900 border-b border-zinc-800">
      {(['recognize', 'browse'] as Tab[]).map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            active === tab
              ? 'text-amber-400 border-b-2 border-amber-400'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {tab === 'recognize' ? '🎵 声音识别' : '🎼 和弦浏览'}
        </button>
      ))}
    </div>
  )
}

export type { Tab }
