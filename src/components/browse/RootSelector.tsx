import { ROOTS } from '../../utils/dbUtils'

interface Props {
  selected: string
  onChange: (root: string) => void
}

export default function RootSelector({ selected, onChange }: Props) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {ROOTS.map(root => (
        <button
          key={root}
          onClick={() => onChange(root)}
          className={`py-2 rounded-lg text-sm font-medium transition-colors ${
            selected === root
              ? 'bg-amber-500 text-zinc-950'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          {root}
        </button>
      ))}
    </div>
  )
}
