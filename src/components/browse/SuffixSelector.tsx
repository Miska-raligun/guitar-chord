import { prettifySuffix } from '../../utils/dbUtils'

interface Props {
  suffixes: string[]
  selected: string
  onChange: (suffix: string) => void
}

export default function SuffixSelector({ suffixes, selected, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none md:flex-wrap md:overflow-x-visible md:pb-0">
      {suffixes.map(suffix => (
        <button
          key={suffix}
          onClick={() => onChange(suffix)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            selected === suffix
              ? 'bg-amber-500 text-zinc-950'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          {suffix}
          {prettifySuffix(suffix) !== suffix && (
            <span className="ml-1 text-zinc-500">·{prettifySuffix(suffix)}</span>
          )}
        </button>
      ))}
    </div>
  )
}
