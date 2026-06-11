import { useState } from 'react'
import type { ChordSlot, MelodyNote, SequencerState } from '../../types/audio'
import { getMelodyDisplaySlots, cellToMasterSlot } from '../../hooks/useSequencer'
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

function getGridDims(displaySlots: number) {
  if (displaySlots <= 4)  return { chordW: 96,  cellW: 22 }
  if (displaySlots <= 6)  return { chordW: 106, cellW: 16 }
  if (displaySlots <= 8)  return { chordW: 126, cellW: 14 }
  if (displaySlots <= 12) return { chordW: 158, cellW: 12 }
  return                         { chordW: 198, cellW: 11 }  // 16 cells
}

export default function SequencerGrid({ state, onChordChange, onMelodyChange, onAddBar }: Props) {
  const [chordPicker, setChordPicker] = useState<ChordPickerTarget | null>(null)
  const [notePicker,  setNotePicker]  = useState<NotePickerTarget | null>(null)

  const { chords, melody, currentBar, keyRoot, melodyRes, timeSig } = state
  const displaySlots = getMelodyDisplaySlots(melodyRes, timeSig)
  const { chordW, cellW } = getGridDims(displaySlots)

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

            return (
              <div key={bar} className="flex flex-col gap-1">
                {/* Bar number */}
                <div className={`text-[10px] text-center ${isActive ? 'text-amber-400 font-bold' : 'text-zinc-600'}`}>
                  {bar + 1}
                </div>

                {/* Chord cell */}
                <button
                  onClick={() => setChordPicker({ bar, slot })}
                  style={{ width: `${chordW}px` }}
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
                      <span className={isActive ? 'text-amber-400' : 'text-zinc-100'}>
                        {slot.root}
                      </span>
                      <span className="text-[10px] text-zinc-500 mt-0.5">
                        {slot.suffix !== 'major' ? slot.suffix : '大调'}
                      </span>
                    </>
                  ) : (
                    <span className="text-zinc-500 text-xs">+</span>
                  )}
                </button>

                {/* Melody cells */}
                <div className="flex gap-0.5">
                  {Array.from({ length: displaySlots }, (_, c) => {
                    const masterSlot = cellToMasterSlot(c, melodyRes)
                    const note  = melody[bar]?.[masterSlot] ?? null
                    const label = solfegeLabel(note)
                    return (
                      <button
                        key={c}
                        onClick={() => setNotePicker({ bar, masterSlot, note })}
                        style={{ width: `${cellW}px` }}
                        className={`h-[32px] rounded text-[9px] font-bold transition-colors flex items-center justify-center ${
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

          {/* Add bar button */}
          {onAddBar && (
            <div className="flex flex-col gap-1">
              <div className="text-[10px] text-center text-transparent">·</div>
              <button
                onClick={onAddBar}
                style={{ width: `${chordW}px` }}
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
