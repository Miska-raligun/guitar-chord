import { IconGuitar } from '../ui/icons'

export default function Header() {
  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur-md border-b border-amber-200/60 relative z-10">
      <span className="grid place-items-center h-8 w-8 rounded-lg bg-amber-500/20 text-amber-600 shrink-0">
        <IconGuitar className="w-4 h-4" />
      </span>
      <h1 className="text-base font-semibold tracking-tight text-stone-800">吉他和弦练习</h1>
    </header>
  )
}
