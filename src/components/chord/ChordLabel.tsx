import { prettifySuffix } from '../../utils/dbUtils'

interface Props {
  root: string
  suffix: string
  confidence?: number
}

export default function ChordLabel({ root, suffix, confidence }: Props) {
  return (
    <div className="text-center">
      <div className="flex items-baseline justify-center gap-1">
        <span className="text-3xl font-bold text-zinc-100">{root}</span>
        <span className="text-lg text-amber-400">{suffix}</span>
      </div>
      <div className="text-sm text-zinc-400 mt-0.5">{prettifySuffix(suffix)}</div>
      {confidence !== undefined && (
        <div className="flex items-center justify-center gap-2 mt-1">
          <div className="h-1.5 w-24 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all"
              style={{ width: `${Math.round(confidence * 100)}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500">{Math.round(confidence * 100)}%</span>
        </div>
      )}
    </div>
  )
}
