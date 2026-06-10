import type { ChordMatch } from '../../types/audio'
import { prettifySuffix } from '../../utils/dbUtils'

interface Props {
  matches: ChordMatch[]
  topRoot: string | null
}

export default function MatchList({ matches, topRoot }: Props) {
  if (matches.length === 0) return null

  return (
    <div className="w-full space-y-2">
      {matches.map((m, i) => (
        <div
          key={`${m.root}-${m.suffix}-${i}`}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
            i === 0 && m.root === topRoot ? 'bg-zinc-700' : 'bg-zinc-800'
          }`}
        >
          <div className="w-6 text-center text-xs text-zinc-500 font-mono">{i + 1}</div>
          <div className="flex-1">
            <div className="flex items-baseline gap-1">
              <span className="font-semibold text-zinc-100">{m.root}</span>
              <span className="text-amber-400 text-sm">{m.suffix}</span>
              <span className="text-zinc-500 text-xs ml-1">{prettifySuffix(m.suffix)}</span>
            </div>
            <div className="mt-1 h-1 bg-zinc-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-200"
                style={{ width: `${Math.round(m.confidence * 100)}%` }}
              />
            </div>
          </div>
          <div className="text-xs text-zinc-400 w-8 text-right">
            {Math.round(m.confidence * 100)}%
          </div>
        </div>
      ))}
    </div>
  )
}
