import { useState } from 'react'
import type { ChordSlot, MelodyNote, SequencerState } from '../../types/audio'
import { getMasterSlotsPerBar } from '../../hooks/useSequencer'
import ChordCellPicker from './ChordCellPicker'
import NotePicker from './NotePicker'
import { SOLFEGE } from './NotePicker'
import { STRING_LABELS } from './FretboardNotePicker'

interface Props {
  state: SequencerState
  onChordChange: (chordIdx: number, slot: ChordSlot) => void
  onMelodyChange: (bar: number, masterSlot: number, note: MelodyNote | null) => void
  onAddBar?: () => void
}

interface ChordPickerTarget { chordIdx: number; slot: ChordSlot }
interface NotePickerTarget  { bar: number; masterSlot: number; note: MelodyNote | null }

const GAP = 2

interface CellEntry {
  masterSlot: number
  note: MelodyNote | null
  flex: number
}

interface PhysicalBar {
  physIdx: number
  chordIdx: number
  barInSlot: number
  slot: ChordSlot
}

function buildPhysicalBars(chords: ChordSlot[]): PhysicalBar[] {
  const result: PhysicalBar[] = []
  chords.forEach((slot, chordIdx) => {
    const bars = slot.bars ?? 1
    for (let b = 0; b < bars; b++) {
      result.push({ physIdx: result.length, chordIdx, barInSlot: b, slot })
    }
  })
  return result
}

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
  const physBars = buildPhysicalBars(chords)

  function solfegeLabel(note: MelodyNote | null): string {
    if (!note) return ''
    const offset = ((note.semitone - keyRoot) % 12 + 12) % 12
    return SOLFEGE[offset]
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-x-2 gap-y-4 px-4">
        {physBars.map(({ physIdx, chordIdx, barInSlot, slot }) => {
          const isActive = currentBar === physIdx
          const hasChord = slot.root !== null
          const isContinuation = barInSlot > 0
          const cells = renderBarCells(melody[physIdx] ?? [], noteDuration, masterSlotsPerBar)

          return (
            <div key={physIdx} className="flex flex-col gap-1 min-w-0">
              {/* Bar number */}
              <div className={`text-[10px] text-center ${isActive ? 'text-amber-400 font-bold' : 'text-zinc-600'}`}>
                {physIdx + 1}
              </div>

              {/* Chord cell */}
              <button
                onClick={() => setChordPicker({ chordIdx, slot })}
                className={`w-full h-14 rounded-lg border text-sm font-semibold transition-all flex flex-col items-center justify-center ${
                  isActive
                    ? 'border-amber-400 ring-2 ring-amber-400/40 bg-zinc-800'
                    : isContinuation
                      ? 'border-zinc-700/50 border-dashed bg-zinc-900/50 hover:border-zinc-600'
                      : hasChord
                        ? 'border-zinc-600 bg-zinc-800 hover:border-zinc-500'
                        : 'border-zinc-700 border-dashed bg-zinc-900 hover:border-zinc-600'
                }`}
              >
                {isContinuation ? (
                  <span className="text-zinc-700 text-lg leading-none">─</span>
                ) : hasChord ? (
                  <>
                    <span className={`leading-none ${isActive ? 'text-amber-400' : 'text-zinc-100'}`}>{slot.root}</span>
                    <span className="text-[10px] text-zinc-500 mt-0.5">
                      {slot.suffix !== 'major' ? slot.suffix : '大调'}
                    </span>
                    {(slot.bars ?? 1) > 1 && (
                      <span className="text-[8px] text-amber-400/60 leading-none mt-0.5">×{slot.bars}</span>
                    )}
                  </>
                ) : (
                  <span className="text-zinc-500 text-xs">+</span>
                )}
              </button>

              {/* Melody row */}
              <div className="flex w-full" style={{ gap: `${GAP}px` }}>
                {cells.map((cell, idx) => {
                  const { masterSlot, note, flex } = cell
                  const label = solfegeLabel(note)
                  return (
                    <button
                      key={idx}
                      style={{ flex, minWidth: 0 }}
                      onClick={() => setNotePicker({ bar: physIdx, masterSlot, note })}
                      className={`h-10 rounded text-[9px] font-bold transition-colors flex flex-col items-center justify-center overflow-hidden gap-px ${
                        note
                          ? 'bg-amber-500/80 text-zinc-950'
                          : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                      }`}
                    >
                      <span>{label || '·'}</span>
                      {note && note.fret !== undefined && note.string !== undefined && (
                        <span className="text-[7px] leading-none opacity-75">
                          {STRING_LABELS[note.string]}{note.fret}
                        </span>
                      )}
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
              className="w-full h-14 rounded-lg border border-dashed border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 text-xl font-light transition-all flex items-center justify-center"
            >
              +
            </button>
          </div>
        )}
      </div>

      {chordPicker && (
        <ChordCellPicker
          slot={chordPicker.slot}
          onSelect={slot => onChordChange(chordPicker.chordIdx, slot)}
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
