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
          className={`py-2 rounded-xl text-sm font-medium transition-colors ${
            selected === root
              ? 'bg-amber-500 text-stone-50'
              : 'bg-amber-100 text-stone-600 hover:bg-amber-200 hover:text-stone-800'
          }`}
        >
          {root}
        </button>
      ))}
    </div>
  )
}
