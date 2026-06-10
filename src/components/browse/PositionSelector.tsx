interface Props {
  total: number
  current: number
  onChange: (index: number) => void
}

export default function PositionSelector({ total, current, onChange }: Props) {
  if (total <= 1) return null

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(0, current - 1))}
        disabled={current === 0}
        className="p-2 rounded-lg bg-zinc-800 text-zinc-300 disabled:opacity-30 hover:bg-zinc-700"
      >
        ←
      </button>
      <span className="text-xs text-zinc-400">
        把位 {current + 1} / {total}
      </span>
      <button
        onClick={() => onChange(Math.min(total - 1, current + 1))}
        disabled={current === total - 1}
        className="p-2 rounded-lg bg-zinc-800 text-zinc-300 disabled:opacity-30 hover:bg-zinc-700"
      >
        →
      </button>
    </div>
  )
}
