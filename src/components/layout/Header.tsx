import { IconGuitar } from '../ui/icons'

export default function Header() {
  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
      <span className="grid place-items-center h-8 w-8 rounded-lg bg-amber-500/15 text-amber-400 shrink-0">
        <IconGuitar className="w-4 h-4" />
      </span>
      <h1 className="text-base font-semibold tracking-tight text-zinc-100">吉他和弦练习</h1>
    </header>
  )
}
