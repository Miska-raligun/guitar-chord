import { useState } from 'react'
import type { ChordSlot, MelodyNote, SequencerState } from '../../types/audio'
import { getMasterSlotsPerBar, getMelodyDisplaySlots, cellToMasterSlot } from '../../hooks/useSequencer'
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

// 单位格子宽度 + 格间距（px）
const GAP = 2
function getUnitCellW(displaySlots: number): number {
  if (displaySlots <= 4)  return 22
  if (displaySlots <= 6)  return 16
  if (displaySlots <= 8)  return 14
  if (displaySlots <= 12) return 11
  return 9   // 16 cells
}
function chordCellW(displaySlots: number): number {
  const cw = getUnitCellW(displaySlots)
  return displaySlots * cw + (displaySlots - 1) * GAP
}

// 计算一小节的显示单元：考虑跨格
interface CellEntry {
  masterSlot: number  // 音符起始槽（或空格槽）
  note: MelodyNote | null
  spanCells: number   // 横跨格数
}
function renderBarCells(
  row: (MelodyNote | null)[],
  noteDuration: SequencerState['noteDuration'],
  masterSlotsPerBar: number,
): CellEntry[] {
  const displaySlots = Math.max(1, Math.floor(masterSlotsPerBar / noteDuration))
  const result: CellEntry[] = []
  let c = 0
  while (c < displaySlots) {
    const masterSlot = cellToMasterSlot(c, noteDuration)
    const note = row[masterSlot] ?? null
    if (note) {
      const span = Math.max(1, Math.min(
        Math.ceil(note.duration / noteDuration),
        displaySlots - c,
      ))
      result.push({ masterSlot, note, spanCells: span })
      c += span
    } else {
      result.push({ masterSlot, note: null, spanCells: 1 })
      c++
    }
  }
  return result
}

export default function SequencerGrid({ state, onChordChange, onMelodyChange, onAddBar }: Props) {
  const [chordPicker, setChordPicker] = useState<ChordPickerTarget | null>(null)
  const [notePicker,  setNotePicker]  = useState<NotePickerTarget | null>(null)

  const { chords, melody, currentBar, keyRoot, noteDuration, timeSig } = state
  const masterSlotsPerBar = getMasterSlotsPerBar(timeSig)
  const displaySlots      = getMelodyDisplaySlots(noteDuration, timeSig)
  const unitCW            = getUnitCellW(displaySlots)
  const totalChordW       = chordCellW(displaySlots)

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
            const barRow   = melody[bar] ?? []
            const cells    = renderBarCells(barRow, noteDuration, masterSlotsPerBar)

            return (
              <div key={bar} className="flex flex-col gap-1">
                {/* Bar number */}
                <div className={`text-[10px] text-center ${isActive ? 'text-amber-400 font-bold' : 'text-zinc-600'}`}>
                  {bar + 1}
                </div>

                {/* Chord cell */}
                <button
                  onClick={() => setChordPicker({ bar, slot })}
                  style={{ width: `${totalChordW}px` }}
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

                {/* Melody cells with duration spanning */}
                <div className="flex" style={{ gap: `${GAP}px` }}>
                  {cells.map((cell, idx) => {
                    const { masterSlot, note, spanCells } = cell
                    const label = solfegeLabel(note)
                    const w = spanCells * unitCW + (spanCells - 1) * GAP
                    return (
                      <button
                        key={idx}
                        style={{ width: `${w}px` }}
                        onClick={() => setNotePicker({ bar, masterSlot, note })}
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
                style={{ width: `${totalChordW}px` }}
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
