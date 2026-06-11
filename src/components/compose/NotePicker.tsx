import type { MelodyNote } from '../../types/audio'
import { ROOTS } from '../../utils/dbUtils'

// solfège display for each semitone relative to key root
const SOLFEGE = ['1', '♯1', '2', '♯2', '3', '4', '♯4', '5', '♯5', '6', '♯6', '7']
const SOLFEGE_NAME = ['Do', '♯Do', 'Re', '♯Re', 'Mi', 'Fa', '♯Fa', 'Sol', '♯Sol', 'La', '♯La', 'Si']

interface Props {
  keyRoot: number
  noteDuration: number
  selected: MelodyNote | null
  onSelect: (note: MelodyNote | null) => void
  onClose: () => void
}

export default function NotePicker({ keyRoot, noteDuration, selected, onSelect, onClose }: Props) {
  const chromaticOrder = [0, 2, 4, 5, 7, 9, 11, 1, 3, 6, 8, 10]

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-white border-t border-amber-200 rounded-t-2xl p-4 pb-8 shadow-xl shadow-amber-200/30"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-stone-400 uppercase tracking-wider">选择旋律音</span>
          <button onClick={onClose} className="text-stone-400 text-sm hover:text-stone-600">关闭</button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {chromaticOrder.slice(0, 7).map(offset => {
            const semitone = (keyRoot + offset) % 12
            const idx = offset
            const isSelected = selected?.semitone === semitone
            return (
              <button
                key={offset}
                onClick={() => onSelect({ semitone, duration: noteDuration })}
                className={`py-2.5 rounded-xl text-xs font-medium flex flex-col items-center gap-0.5 transition-colors ${
                  isSelected
                    ? 'bg-amber-500 text-stone-50'
                    : 'bg-amber-100 text-stone-700 hover:bg-amber-200'
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
                onClick={() => onSelect({ semitone, duration: noteDuration })}
                className={`py-2.5 rounded-xl text-xs font-medium flex flex-col items-center gap-0.5 transition-colors ${
                  isSelected
                    ? 'bg-amber-500 text-stone-50'
                    : 'bg-amber-100 text-stone-600 hover:bg-amber-200'
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
          className="w-full py-2.5 rounded-xl bg-amber-100 text-stone-600 text-sm hover:bg-amber-200 transition-colors"
        >
          清除音符
        </button>
      </div>
    </div>
  )
}

export { SOLFEGE, SOLFEGE_NAME }
