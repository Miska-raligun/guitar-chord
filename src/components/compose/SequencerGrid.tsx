import { useState } from 'react'
import type { ChordSlot, MelodyNote, SequencerState } from '../../types/audio'
import ChordCellPicker from './ChordCellPicker'
import NotePicker from './NotePicker'
import { SOLFEGE } from './NotePicker'
import { ROOTS } from '../../utils/dbUtils'

interface Props {
  state: SequencerState
  onChordChange: (bar: number, slot: ChordSlot) => void
  onMelodyChange: (bar: number, beat: number, note: MelodyNote | null) => void
}

interface ChordPickerTarget { bar: number; slot: ChordSlot }
interface NotePickerTarget  { bar: number; beat: number; note: MelodyNote | null }

export default function SequencerGrid({ state, onChordChange, onMelodyChange }: Props) {
  const [chordPicker, setChordPicker] = useState<ChordPickerTarget | null>(null)
  const [notePicker,  setNotePicker]  = useState<NotePickerTarget | null>(null)

  const { chords, melody, currentBar, keyRoot } = state

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
                  className={`w-[96px] h-[52px] rounded-lg border text-sm font-semibold transition-all flex flex-col items-center justify-center ${
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
                    <span className="text-zinc-500 text-xs">点击选和弦</span>
                  )}
                </button>

                {/* Melody beat cells (4 per bar) */}
                <div className="flex gap-0.5">
                  {Array.from({ length: 4 }, (_, beat) => {
                    const note = melody[bar]?.[beat] ?? null
                    const label = solfegeLabel(note)
                    return (
                      <button
                        key={beat}
                        onClick={() => setNotePicker({ bar, beat, note })}
                        className={`w-[22px] h-[32px] rounded text-[9px] font-bold transition-colors flex items-center justify-center ${
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
        </div>
      </div>

      {chordPicker && (
        <ChordCellPicker
          slot={chordPicker.slot}
          onSelect={slot => {
            onChordChange(chordPicker.bar, slot)
          }}
          onClose={() => setChordPicker(null)}
        />
      )}

      {notePicker && (
        <NotePicker
          keyRoot={keyRoot}
          selected={notePicker.note}
          onSelect={note => {
            onMelodyChange(notePicker.bar, notePicker.beat, note)
            setNotePicker(null)
          }}
          onClose={() => setNotePicker(null)}
        />
      )}
    </>
  )
}
