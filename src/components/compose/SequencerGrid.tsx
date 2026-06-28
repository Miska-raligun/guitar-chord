import { useState } from 'react'
import type { ChordSlot, MelodyNote, SequencerState } from '../../types/audio'
import { getMasterSlotsPerBar, getChordMasterDuration } from '../../hooks/useSequencer'
import ChordCellPicker from './ChordCellPicker'
import NotePicker from './NotePicker'
import { SOLFEGE } from './NotePicker'
import { STRING_LABELS } from './FretboardNotePicker'

interface Props {
  state: SequencerState
  onChordChange: (chordIdx: number, slot: ChordSlot) => void
  onMelodyChange: (bar: number, masterSlot: number, note: MelodyNote | null) => void
  onAddBar?: (noteValue?: 1|2|4|8|16) => void
  onAddStrumPattern?: (slots: ChordSlot[]) => void
}

const NV_ADD: { v: 1|2|4|8|16; label: string; title: string }[] = [
  { v: 1,  label: '全',  title: '全音符（1小节）' },
  { v: 2,  label: '½',   title: '二分音符（½小节）' },
  { v: 4,  label: '♩',   title: '四分音符' },
  { v: 8,  label: '♪',   title: '八分音符' },
  { v: 16, label: '♬',   title: '十六分音符' },
]

// 扫弦方向显示符号
const DIR_GLYPH: Record<'D'|'U'|'X', string> = { D: '↓', U: '↑', X: '✕' }

// 常见扫弦节奏型：每个 strike 为一个八分音符 D=下 U=上 X=闷音 -=休止
type Strike = 'D' | 'U' | 'X' | '-'
function cyc(motif: Strike[], n: number): Strike[] {
  return Array.from({ length: n }, (_, i) => motif[i % motif.length])
}
const STRUM_PRESETS: { key: string; label: string; title: string; build: (eighths: number) => Strike[] }[] = [
  { key: 'q-down', label: '↓↓↓↓',      title: '四分下扫', build: n => Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 'D' : '-')) },
  { key: 'e-alt',  label: '↓↑↓↑',      title: '八分下上', build: n => Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 'D' : 'U')) },
  { key: 'folk',   label: '↓ ↓↑ ↑↓↑', title: '民谣节奏', build: n => cyc(['D', '-', 'D', 'U', '-', 'U', 'D', 'U'], n) },
  { key: 'mute',   label: '↓✕↓↑✕↑',   title: '切音节奏', build: n => cyc(['D', 'X', 'D', 'U', 'X', 'U', 'D', 'U'], n) },
]

// 每小节的八分音符数（决定节奏型长度）
function eighthsPerBar(timeSig: SequencerState['timeSig']): number {
  if (timeSig === '4/4') return 8
  if (timeSig === '3/4' || timeSig === '6/8') return 6
  return 4  // 2/4
}

// 取序列中最后一个有效和弦作为节奏型填充的默认和弦
function lastChord(chords: ChordSlot[]): { root: string; suffix: string } {
  for (let i = chords.length - 1; i >= 0; i--) {
    if (chords[i].root && chords[i].suffix) {
      return { root: chords[i].root!, suffix: chords[i].suffix! }
    }
  }
  return { root: 'C', suffix: 'major' }
}

interface ChordPickerTarget { chordIdx: number; slot: ChordSlot; isStrum: boolean }
interface NotePickerTarget  { bar: number; masterSlot: number; note: MelodyNote | null }

const GAP = 2

// Note value denominator → display label
const NV_LABEL: Record<number, string> = { 1: '', 2: '½', 4: '♩', 8: '♪', 16: '♬' }

interface CellEntry {
  masterSlot: number
  note: MelodyNote | null
  flex: number
}

function renderBarCells(
  row: (MelodyNote | null)[],
  noteDuration: number,
  displaySlots: number,
): CellEntry[] {
  const result: CellEntry[] = []
  let m = 0
  while (m < displaySlots) {
    const note = row[m]
    if (note) {
      const dur = Math.min(note.duration, displaySlots - m)
      result.push({ masterSlot: m, note, flex: dur })
      m += dur
    } else {
      const boundary = Math.ceil((m + 1) / noteDuration) * noteDuration
      let end = Math.min(boundary, displaySlots)
      for (let n = m + 1; n < end; n++) {
        if (row[n]) { end = n; break }
      }
      result.push({ masterSlot: m, note: null, flex: end - m })
      m = end
    }
  }
  return result
}

// Compute bar number (1-indexed) for each chord slot
function computeBarNumbers(chords: ChordSlot[]): number[] {
  let cumBars = 0
  return chords.map(slot => {
    const barNum = Math.floor(cumBars) + 1
    cumBars += 1 / (slot.noteValue ?? 1)
    return barNum
  })
}

export default function SequencerGrid({ state, onChordChange, onMelodyChange, onAddBar, onAddStrumPattern }: Props) {
  const [chordPicker, setChordPicker] = useState<ChordPickerTarget | null>(null)
  const [notePicker,  setNotePicker]  = useState<NotePickerTarget | null>(null)

  const { chords, melody, currentBar, keyRoot, noteDuration, timeSig, pattern } = state
  const masterSlotsPerBar = getMasterSlotsPerBar(timeSig)
  const isStrum = pattern === 'strum'
  const barNumbers = computeBarNumbers(chords)

  function solfegeLabel(note: MelodyNote | null): string {
    if (!note) return ''
    const offset = ((note.semitone - keyRoot) % 12 + 12) % 12
    return SOLFEGE[offset]
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-x-2 gap-y-4 px-4">
        {chords.map((slot, chordIdx) => {
          const isActive  = currentBar === chordIdx
          const hasChord  = slot.root !== null
          const chordDur  = isStrum ? getChordMasterDuration(slot, timeSig) : masterSlotsPerBar
          const cells     = renderBarCells(melody[chordIdx] ?? [], noteDuration, chordDur)
          const nvLabel   = isStrum ? (NV_LABEL[slot.noteValue ?? 1] ?? '') : ''
          const dirGlyph  = isStrum && hasChord ? DIR_GLYPH[slot.strumDir ?? 'D'] : ''
          const barNum    = barNumbers[chordIdx]

          return (
            <div key={chordIdx} className="flex flex-col gap-1 min-w-0">
              {/* Bar number */}
              <div className={`text-[10px] text-center ${isActive ? 'text-amber-400 font-bold' : 'text-zinc-600'}`}>
                {barNum}
              </div>

              {/* Chord cell */}
              <button
                onClick={() => { setNotePicker(null); setChordPicker({ chordIdx, slot, isStrum }) }}
                className={`w-full h-14 rounded-lg border text-sm font-semibold transition-all flex flex-col items-center justify-center ${
                  isActive
                    ? 'border-amber-400 ring-2 ring-amber-400/40 bg-zinc-800'
                    : hasChord
                      ? 'border-zinc-600 bg-zinc-800 hover:border-zinc-500'
                      : 'border-zinc-700 border-dashed bg-zinc-900 hover:border-zinc-600'
                }`}
              >
                {hasChord ? (
                  <>
                    <span className={`leading-none ${isActive ? 'text-amber-400' : 'text-zinc-100'}`}>{slot.root}</span>
                    <span className="text-[10px] text-zinc-500 mt-0.5">
                      {slot.suffix !== 'major' ? slot.suffix : '大调'}
                    </span>
                    {(dirGlyph || nvLabel) && (
                      <span className="text-[9px] text-amber-400/70 leading-none mt-0.5">{dirGlyph}{nvLabel}</span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-zinc-500 text-xs">+</span>
                    {nvLabel && (
                      <span className="text-[9px] text-zinc-600 leading-none mt-0.5">{nvLabel}</span>
                    )}
                  </>
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
                      onClick={() => { setChordPicker(null); setNotePicker({ bar: chordIdx, masterSlot, note }) }}
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

        {/* Add controls */}
        {onAddBar && (isStrum ? (
          <div className="col-span-4 pt-1 space-y-3">
            {/* Preset rhythm patterns — fill one bar at once */}
            {onAddStrumPattern && (
              <div>
                <div className="text-[10px] text-zinc-600 mb-1.5">节奏型（填充一小节，使用最近的和弦）</div>
                <div className="flex gap-1.5">
                  {STRUM_PRESETS.map(({ key, label, title, build }) => (
                    <button
                      key={key}
                      title={title}
                      onClick={() => {
                        const { root, suffix } = lastChord(chords)
                        const strikes = build(eighthsPerBar(timeSig))
                        const slots: ChordSlot[] = strikes.map(st =>
                          st === '-'
                            ? { root: null, suffix: null, positionIndex: 0, noteValue: 8 }
                            : { root, suffix, positionIndex: 0, noteValue: 8, ...(st !== 'D' ? { strumDir: st } : {}) }
                        )
                        onAddStrumPattern(slots)
                      }}
                      className="flex-1 h-10 rounded-lg border border-dashed border-zinc-700 bg-zinc-900 hover:border-amber-500/50 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 text-[11px] font-medium transition-all flex flex-col items-center justify-center leading-tight"
                    >
                      <span>{title}</span>
                      <span className="text-[9px] text-zinc-600">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Single chord add by note value */}
            <div>
              <div className="text-[10px] text-zinc-600 mb-1.5">添加单个和弦（下扫）</div>
              <div className="flex gap-1.5">
                {NV_ADD.map(({ v, label, title }) => (
                  <button
                    key={v}
                    title={title}
                    onClick={() => onAddBar(v)}
                    className="flex-1 h-10 rounded-lg border border-dashed border-zinc-700 bg-zinc-900 hover:border-amber-500/50 hover:bg-zinc-800 text-zinc-500 hover:text-amber-400 text-sm font-medium transition-all"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1 min-w-0">
            <div className="text-[10px] text-center text-transparent">·</div>
            <button
              onClick={() => onAddBar()}
              className="w-full h-14 rounded-lg border border-dashed border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 text-xl font-light transition-all flex items-center justify-center"
            >
              +
            </button>
          </div>
        ))}

        {/* Spacer so grid can scroll above the open picker panel.
            Note picker in fretboard mode can be ~80vh tall, so give generous room. */}
        {chordPicker && <div className="col-span-4 h-52" />}
        {notePicker  && <div className="col-span-4 h-[78vh]" />}
      </div>

      {chordPicker && (
        <ChordCellPicker
          key={chordPicker.chordIdx}
          slot={chordPicker.slot}
          isStrum={chordPicker.isStrum}
          onSelect={slot => onChordChange(chordPicker.chordIdx, slot)}
          onClose={() => setChordPicker(null)}
        />
      )}

      {notePicker && (
        <NotePicker
          keyRoot={keyRoot}
          noteDuration={noteDuration}
          selected={melody[notePicker.bar]?.[notePicker.masterSlot] ?? null}
          onSelect={note => {
            onMelodyChange(notePicker.bar, notePicker.masterSlot, note)
            // Keep picker open — user closes it explicitly
          }}
          onClose={() => setNotePicker(null)}
        />
      )}
    </>
  )
}
