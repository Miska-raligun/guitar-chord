import { prettifySuffix } from '../../utils/dbUtils'

interface Props {
  suffixes: string[]
  selected: string
  onChange: (suffix: string) => void
}

export default function SuffixSelector({ suffixes, selected, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {suffixes.map(suffix => (
        <button
          key={suffix}
          onClick={() => onChange(suffix)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            selected === suffix
              ? 'bg-amber-500 text-stone-50'
              : 'bg-amber-100 text-stone-600 hover:bg-amber-200 hover:text-stone-800'
          }`}
        >
          {suffix}
          {prettifySuffix(suffix) !== suffix && (
            <span className="ml-1 text-stone-400 opacity-70">·{prettifySuffix(suffix)}</span>
          )}
        </button>
      ))}
    </div>
  )
}
