import { useState } from 'react'
import type { ChordSlot, MelodyNote, SequencerState } from '../../types/audio'
import { getMasterSlotsPerBar } from '../../hooks/useSequencer'
import ChordCellPicker from './ChordCellPicker'
import NotePicker from './NotePicker'
import { SOLFEGE } from './NotePicker'

interface Props {
  state: SequencerState
  onChordChange: (bar: number, slot: ChordSlot) => void
  onMelodyChange: (bar: number, masterSlot: number, note: MelodyNote | null) => void
  onAddBar?: () => void
}

interface ChordPickerTarget { bar: number; slot: ChordSlot }
interface NotePickerTarget  { bar: number; masterSlot: number; note: MelodyNote | null }

const GAP = 2  // px between melody cells

interface CellEntry {
  masterSlot: number
  note: MelodyNote | null
  flex: number  // proportional width (= durationSlots in master slots)
}

// Traverse at master-slot level:
// - Notes: occupy their exact duration
// - Empties: snap to next noteDuration boundary (or next note)
function renderBarCells(
  row: (MelodyNote | null)[],
  noteDuration: number,
  masterSlotsPerBar: number,
): CellEntry[] {
  const result: CellEntry[] = []
  let m = 0
  while (m < masterSlotsPerBar) {
    const note = row[m]
    if (note) {
      const dur = Math.min(note.duration, masterSlotsPerBar - m)
      result.push({ masterSlot: m, note, flex: dur })
      m += dur
    } else {
      // Advance to next noteDuration boundary, but stop early if a note is found
      const boundary = Math.ceil((m + 1) / noteDuration) * noteDuration
      let end = Math.min(boundary, masterSlotsPerBar)
      for (let n = m + 1; n < end; n++) {
        if (row[n]) { end = n; break }
      }
      result.push({ masterSlot: m, note: null, flex: end - m })
      m = end
    }
  }
  return result
}

export default function SequencerGrid({ state, onChordChange, onMelodyChange, onAddBar }: Props) {
  const [chordPicker, setChordPicker] = useState<ChordPickerTarget | null>(null)
  const [notePicker,  setNotePicker]  = useState<NotePickerTarget | null>(null)

  const { chords, melody, currentBar, keyRoot, noteDuration, timeSig } = state
  const masterSlotsPerBar = getMasterSlotsPerBar(timeSig)

  function solfegeLabel(note: MelodyNote | null): string {
    if (!note) return ''
    const offset = ((note.semitone - keyRoot) % 12 + 12) % 12
    return SOLFEGE[offset]
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-x-2 gap-y-4 px-4">
        {chords.map((slot, bar) => {
          const isActive = currentBar === bar
          const hasChord = slot.root !== null
          const cells = renderBarCells(melody[bar] ?? [], noteDuration, masterSlotsPerBar)

          return (
            <div key={bar} className="flex flex-col gap-1 min-w-0">
              {/* Bar number */}
              <div className={`text-[10px] text-center font-medium ${isActive ? 'text-amber-600 font-bold' : 'text-stone-400'}`}>
                {bar + 1}
              </div>

              {/* Chord cell */}
              <button
                onClick={() => setChordPicker({ bar, slot })}
                className={`w-full h-14 rounded-xl border text-sm font-semibold transition-all flex flex-col items-center justify-center ${
                  isActive
                    ? 'border-amber-500 ring-2 ring-amber-400/40 bg-amber-50'
                    : hasChord
                      ? 'border-amber-300 bg-white hover:border-amber-400 shadow-sm shadow-amber-100'
                      : 'border-amber-200 border-dashed bg-white/50 hover:border-amber-300 hover:bg-white/80'
                }`}
              >
                {hasChord ? (
                  <>
                    <span className={isActive ? 'text-amber-600' : 'text-stone-800'}>{slot.root}</span>
                    <span className="text-[10px] text-stone-400 mt-0.5">
                      {slot.suffix !== 'major' ? slot.suffix : '大调'}
                    </span>
                  </>
                ) : (
                  <span className="text-stone-300 text-xs">+</span>
                )}
              </button>

              {/* Melody row — flex-grow proportional to duration */}
              <div className="flex w-full" style={{ gap: `${GAP}px` }}>
                {cells.map((cell, idx) => {
                  const { masterSlot, note, flex } = cell
                  const label = solfegeLabel(note)
                  return (
                    <button
                      key={idx}
                      style={{ flex, minWidth: 0 }}
                      onClick={() => setNotePicker({ bar, masterSlot, note })}
                      className={`h-10 rounded-lg text-[9px] font-bold transition-colors flex items-center justify-center overflow-hidden ${
                        note
                          ? 'bg-amber-500 text-stone-50 shadow-sm shadow-amber-300'
                          : 'bg-amber-100 text-stone-400 hover:bg-amber-200'
                      }`}
                    >
                      {label || '·'}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Add bar */}
        {onAddBar && (
          <div className="flex flex-col gap-1 min-w-0">
            <div className="text-[10px] text-center text-transparent">·</div>
            <button
              onClick={onAddBar}
              className="w-full h-14 rounded-xl border border-dashed border-amber-200 bg-white/40 hover:border-amber-400 hover:bg-white/80 text-stone-300 hover:text-stone-500 text-xl font-light transition-all flex items-center justify-center"
            >
              +
            </button>
          </div>
        )}
      </div>

      {chordPicker && (
        <ChordCellPicker
          slot={chordPicker.slot}
          onSelect={slot => onChordChange(chordPicker.bar, slot)}
          onClose={() => setChordPicker(null)}
        />
      )}

      {notePicker && (
        <NotePicker
          keyRoot={keyRoot}
          noteDuration={noteDuration}
          selected={notePicker.note}
          onSelect={note => {
            onMelodyChange(notePicker.bar, notePicker.masterSlot, note)
            setNotePicker(null)
          }}
          onClose={() => setNotePicker(null)}
        />
      )}
    </>
  )
}
