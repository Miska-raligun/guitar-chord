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
        <span className="text-3xl font-bold text-stone-800">{root}</span>
        <span className="text-lg text-amber-600">{suffix}</span>
      </div>
      <div className="text-sm text-stone-500 mt-0.5">{prettifySuffix(suffix)}</div>
      {confidence !== undefined && (
        <div className="flex items-center justify-center gap-2 mt-1">
          <div className="h-1.5 w-24 bg-amber-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${Math.round(confidence * 100)}%` }}
            />
          </div>
          <span className="text-xs text-stone-400">{Math.round(confidence * 100)}%</span>
        </div>
      )}
    </div>
  )
}
