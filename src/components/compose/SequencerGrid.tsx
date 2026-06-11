import { useState } from 'react'
import type { ChordSlot, MelodyNote, SequencerState, TimeSig } from '../../types/audio'
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

const GAP = 2  // px between cells

// Fixed chord/melody row width based on time signature (anchored to 8th-note density)
function getBarWidth(timeSig: TimeSig): number {
  const n8th = getMasterSlotsPerBar(timeSig) / 2  // number of 8th notes per bar
  return n8th * 16 - GAP  // 14px per 8th note + 2px gap, minus trailing gap
}

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
  const barW = getBarWidth(timeSig)

  function solfegeLabel(note: MelodyNote | null): string {
    if (!note) return ''
    const offset = ((note.semitone - keyRoot) % 12 + 12) % 12
    return SOLFEGE[offset]
  }

  return (
    <>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-2 px-4 min-w-max">
          {chords.map((slot, bar) => {
            const isActive = currentBar === bar
            const hasChord = slot.root !== null
            const cells = renderBarCells(melody[bar] ?? [], noteDuration, masterSlotsPerBar)

            return (
              <div key={bar} className="flex flex-col gap-1">
                {/* Bar number */}
                <div className={`text-[10px] text-center ${isActive ? 'text-amber-400 font-bold' : 'text-zinc-600'}`}>
                  {bar + 1}
                </div>

                {/* Chord cell */}
                <button
                  onClick={() => setChordPicker({ bar, slot })}
                  style={{ width: `${barW}px` }}
                  className={`h-[52px] rounded-lg border text-sm font-semibold transition-all flex flex-col items-center justify-center ${
                    isActive
                      ? 'border-amber-400 ring-2 ring-amber-400/40 bg-zinc-800'
                      : hasChord
                        ? 'border-zinc-600 bg-zinc-800 hover:border-zinc-500'
                        : 'border-zinc-700 border-dashed bg-zinc-900 hover:border-zinc-600'
                  }`}
                >
                  {hasChord ? (
                    <>
                      <span className={isActive ? 'text-amber-400' : 'text-zinc-100'}>{slot.root}</span>
                      <span className="text-[10px] text-zinc-500 mt-0.5">
                        {slot.suffix !== 'major' ? slot.suffix : '大调'}
                      </span>
                    </>
                  ) : (
                    <span className="text-zinc-500 text-xs">+</span>
                  )}
                </button>

                {/* Melody row — flex-grow proportional to duration */}
                <div
                  className="flex"
                  style={{ width: `${barW}px`, gap: `${GAP}px` }}
                >
                  {cells.map((cell, idx) => {
                    const { masterSlot, note, flex } = cell
                    const label = solfegeLabel(note)
                    return (
                      <button
                        key={idx}
                        style={{ flex, minWidth: 0 }}
                        onClick={() => setNotePicker({ bar, masterSlot, note })}
                        className={`h-[32px] rounded text-[9px] font-bold transition-colors flex items-center justify-center overflow-hidden ${
                          note
                            ? 'bg-amber-500/80 text-zinc-950'
                            : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
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
            <div className="flex flex-col gap-1">
              <div className="text-[10px] text-center text-transparent">·</div>
              <button
                onClick={onAddBar}
                style={{ width: `${barW}px` }}
                className="h-[52px] rounded-lg border border-dashed border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 text-xl font-light transition-all flex items-center justify-center"
              >
                +
              </button>
            </div>
          )}
        </div>
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
