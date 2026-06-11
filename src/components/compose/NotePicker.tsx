import type { MelodyNote } from '../../types/audio'
import { ROOTS } from '../../utils/dbUtils'

// solfège display for each semitone relative to key root
const SOLFEGE = ['1', '♯1', '2', '♯2', '3', '4', '♯4', '5', '♯5', '6', '♯6', '7']
const SOLFEGE_NAME = ['Do', '♯Do', 'Re', '♯Re', 'Mi', 'Fa', '♯Fa', 'Sol', '♯Sol', 'La', '♯La', 'Si']

interface Props {
  keyRoot: number
  selected: MelodyNote | null
  onSelect: (note: MelodyNote | null) => void
  onClose: () => void
}

export default function NotePicker({ keyRoot, selected, onSelect, onClose }: Props) {
  // Build buttons for the 7 natural scale degrees (C major scale intervals: 0,2,4,5,7,9,11)
  // Show all 12 chromatic notes arranged in two rows: natural (7) + chromatic (5)
  const chromaticOrder = [0, 2, 4, 5, 7, 9, 11, 1, 3, 6, 8, 10]

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-zinc-900 border-t border-zinc-700 rounded-t-2xl p-4 pb-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-zinc-400 uppercase tracking-wider">选择旋律音</span>
          <button onClick={onClose} className="text-zinc-500 text-sm">关闭</button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {chromaticOrder.slice(0, 7).map(offset => {
            const semitone = (keyRoot + offset) % 12
            const idx = offset
            const isSelected = selected?.semitone === semitone
            return (
              <button
                key={offset}
                onClick={() => onSelect({ semitone })}
                className={`py-2.5 rounded-lg text-xs font-medium flex flex-col items-center gap-0.5 transition-colors ${
                  isSelected
                    ? 'bg-amber-500 text-zinc-950'
                    : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                }`}
              >
                <span className="font-bold">{SOLFEGE[idx]}</span>
                <span className="text-[10px] opacity-70">{ROOTS[semitone]}</span>
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-5 gap-1.5 mb-3">
          {chromaticOrder.slice(7).map(offset => {
            const semitone = (keyRoot + offset) % 12
            const idx = offset
            const isSelected = selected?.semitone === semitone
            return (
              <button
                key={offset}
                onClick={() => onSelect({ semitone })}
                className={`py-2.5 rounded-lg text-xs font-medium flex flex-col items-center gap-0.5 transition-colors ${
                  isSelected
                    ? 'bg-amber-500 text-zinc-950'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                <span className="font-bold">{SOLFEGE[idx]}</span>
                <span className="text-[10px] opacity-70">{ROOTS[semitone]}</span>
              </button>
            )
          })}
        </div>

        <button
          onClick={() => onSelect(null)}
          className="w-full py-2.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors"
        >
          清除音符
        </button>
      </div>
    </div>
  )
}

export { SOLFEGE, SOLFEGE_NAME }
