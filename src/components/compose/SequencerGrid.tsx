import { useState } from 'react'
import type { ChordSlot, MelodyNote, SequencerState, TimeSig } from '../../types/audio'
import { getMasterSlotsPerBar, getChordMasterDuration } from '../../hooks/useSequencer'
import ChordCellPicker from './ChordCellPicker'
import NotePicker from './NotePicker'
import { SOLFEGE } from './NotePicker'
import { STRING_LABELS } from './FretboardNotePicker'
import { STRUM_PRESETS, eighthsPerBar, buildPatternSlots } from '../../data/strumPatterns'

interface Props {
  state: SequencerState
  onChordChange: (chordIdx: number, slot: ChordSlot) => void
  onMelodyChange: (bar: number, masterSlot: number, note: MelodyNote | null) => void
  onAddBar?: (noteValue?: 1|2|4|8|16) => void
  onAddStrumPattern?: (slots: ChordSlot[]) => void
  onFillBarAt?: (chordIdx: number, slots: ChordSlot[]) => void
  onSetBarSubdivision?: (firstChordIdx: number, noteValue: 1|2|4|8|16) => void
}

// 时值分档（同时用作"细分小节"的档位）
const NV_ADD: { v: 1|2|4|8|16; label: string; title: string }[] = [
  { v: 1,  label: '全',  title: '全音符（整小节）' },
  { v: 2,  label: '½',   title: '二分音符（½小节）' },
  { v: 4,  label: '♩',   title: '四分音符（¼小节）' },
  { v: 8,  label: '♪',   title: '八分音符（⅛小节）' },
  { v: 16, label: '♬',   title: '十六分音符（1/16小节）' },
]

// 扫弦方向显示符号
const DIR_GLYPH: Record<'D'|'U'|'X', string> = { D: '↓', U: '↑', X: '✕' }

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

interface BarSlotRef { slot: ChordSlot; index: number }
interface BarGroup {
  barNum: number
  firstIdx: number
  slots: BarSlotRef[]
  uniformNv: (1|2|4|8|16) | null   // 若整小节内时值一致，则为该时值（用于高亮细分档位）
}

// 把扁平的和弦事件按小节分组（按累计时长填满一小节切一组）
function groupIntoBars(chords: ChordSlot[], timeSig: TimeSig): BarGroup[] {
  const masterPerBar = getMasterSlotsPerBar(timeSig)
  const bars: BarGroup[] = []
  let cur: BarSlotRef[] = []
  let acc = 0
  let barNum = 1
  chords.forEach((slot, index) => {
    cur.push({ slot, index })
    acc += getChordMasterDuration(slot, timeSig)
    if (acc >= masterPerBar) {
      bars.push(makeBar(barNum, cur))
      cur = []
      acc = 0
      barNum++
    }
  })
  if (cur.length) bars.push(makeBar(barNum, cur))
  return bars
}

function makeBar(barNum: number, slots: BarSlotRef[]): BarGroup {
  const nvs = slots.map(r => r.slot.noteValue ?? 1)
  const uniform = nvs.every(v => v === nvs[0]) ? nvs[0] as (1|2|4|8|16) : null
  return { barNum, firstIdx: slots[0].index, slots, uniformNv: uniform }
}

export default function SequencerGrid({ state, onChordChange, onMelodyChange, onAddBar, onAddStrumPattern, onFillBarAt, onSetBarSubdivision }: Props) {
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

  // 单个旋律小格
  function melodyCell(chordIdx: number, entry: CellEntry, key: string) {
    const { masterSlot, note, flex } = entry
    const label = solfegeLabel(note)
    return (
      <button
        key={key}
        style={{ flex, minWidth: 0 }}
        onClick={() => { setChordPicker(null); setNotePicker({ bar: chordIdx, masterSlot, note }) }}
        className={`h-10 rounded text-[9px] font-bold transition-colors flex flex-col items-center justify-center overflow-hidden gap-px ${
          note ? 'bg-amber-500/80 text-zinc-950' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
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
  }

  // ── 扫弦模式：按小节分组，每小节一整块，按时值细分为多个和弦小格 ──
  function renderStrum() {
    const bars = groupIntoBars(chords, timeSig)
    return (
      <div className="flex flex-col gap-4 px-4">
        {bars.map(bar => {
          const barActive = bar.slots.some(r => r.index === currentBar)
          // 拼出整小节连续的旋律小格
          const melodyCells: { chordIdx: number; entry: CellEntry }[] = []
          bar.slots.forEach(({ slot, index }) => {
            const dur = getChordMasterDuration(slot, timeSig)
            renderBarCells(melody[index] ?? [], noteDuration, dur).forEach(entry =>
              melodyCells.push({ chordIdx: index, entry })
            )
          })

          return (
            <div key={bar.firstIdx} className="flex flex-col gap-1">
              {/* 小节头：编号 + 细分档位 */}
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[10px] ${barActive ? 'text-amber-400 font-bold' : 'text-zinc-600'}`}>
                  第 {bar.barNum} 小节
                </span>
                {onSetBarSubdivision && (
                  <div className="flex gap-0.5">
                    {NV_ADD.map(({ v, label, title }) => (
                      <button
                        key={v}
                        title={`细分：${title}`}
                        onClick={() => onSetBarSubdivision(bar.firstIdx, v)}
                        className={`w-6 h-6 rounded text-[11px] transition-colors ${
                          bar.uniformNv === v
                            ? 'bg-amber-500 text-zinc-950 font-semibold'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 和弦小格（按时值宽度切分） */}
              <div className="flex w-full" style={{ gap: `${GAP}px` }}>
                {bar.slots.map(({ slot, index }) => {
                  const dur = getChordMasterDuration(slot, timeSig)
                  const isActive = index === currentBar
                  const hasChord = slot.root !== null
                  const dirGlyph = hasChord ? DIR_GLYPH[slot.strumDir ?? 'D'] : ''
                  return (
                    <button
                      key={index}
                      style={{ flex: dur, minWidth: 0 }}
                      onClick={() => { setNotePicker(null); setChordPicker({ chordIdx: index, slot, isStrum }) }}
                      className={`h-14 rounded-lg border text-sm font-semibold transition-all flex flex-col items-center justify-center overflow-hidden px-0.5 ${
                        isActive
                          ? 'border-amber-400 ring-2 ring-amber-400/40 bg-zinc-800'
                          : hasChord
                            ? 'border-zinc-600 bg-zinc-800 hover:border-zinc-500'
                            : 'border-zinc-700 border-dashed bg-zinc-900 hover:border-zinc-600'
                      }`}
                    >
                      {hasChord ? (
                        <>
                          <span className={`leading-none truncate max-w-full ${isActive ? 'text-amber-400' : 'text-zinc-100'}`}>{slot.root}</span>
                          {slot.suffix && slot.suffix !== 'major' && (
                            <span className="text-[9px] text-zinc-500 leading-tight truncate max-w-full">{slot.suffix}</span>
                          )}
                          {dirGlyph && <span className="text-[9px] text-amber-400/70 leading-none mt-0.5">{dirGlyph}</span>}
                        </>
                      ) : (
                        <span className="text-zinc-500 text-xs">+</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* 旋律行（贯穿整小节） */}
              <div className="flex w-full" style={{ gap: `${GAP}px` }}>
                {melodyCells.map(({ chordIdx, entry }, i) =>
                  melodyCell(chordIdx, entry, `${chordIdx}-${entry.masterSlot}-${i}`),
                )}
              </div>
            </div>
          )
        })}

        {/* 添加控件 */}
        <div className="pt-1 space-y-3">
          {onAddStrumPattern && (
            <div>
              <div className="text-[10px] text-zinc-600 mb-1.5">节奏型（追加一小节，使用最近的和弦）</div>
              <div className="flex gap-1.5">
                {STRUM_PRESETS.map(({ key, label, title, build }) => (
                  <button
                    key={key}
                    title={title}
                    onClick={() => {
                      const { root, suffix } = lastChord(chords)
                      onAddStrumPattern(buildPatternSlots(root, suffix, build(eighthsPerBar(timeSig))))
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
          {onAddBar && (
            <button
              onClick={() => onAddBar()}
              className="w-full h-10 rounded-lg border border-dashed border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 text-sm font-medium transition-all"
            >
              + 添加空白小节
            </button>
          )}
        </div>

        {chordPicker && <div className="h-52" />}
        {notePicker  && <div className="h-[78vh]" />}
      </div>
    )
  }

  // ── 分解和弦 / 其他模式：保持原有布局（每个和弦一整小节） ──
  function renderFingerpicking() {
    return (
      <div className="grid grid-cols-4 gap-x-2 gap-y-4 px-4">
        {chords.map((slot, chordIdx) => {
          const isActive  = currentBar === chordIdx
          const hasChord  = slot.root !== null
          const cells     = renderBarCells(melody[chordIdx] ?? [], noteDuration, masterSlotsPerBar)
          const barNum    = barNumbers[chordIdx]

          return (
            <div key={chordIdx} className="flex flex-col gap-1 min-w-0">
              <div className={`text-[10px] text-center ${isActive ? 'text-amber-400 font-bold' : 'text-zinc-600'}`}>
                {barNum}
              </div>

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
                  </>
                ) : (
                  <span className="text-zinc-500 text-xs">+</span>
                )}
              </button>

              <div className="flex w-full" style={{ gap: `${GAP}px` }}>
                {cells.map((cell, idx) => melodyCell(chordIdx, cell, `${chordIdx}-${idx}`))}
              </div>
            </div>
          )
        })}

        {onAddBar && (
          <div className="flex flex-col gap-1 min-w-0">
            <div className="text-[10px] text-center text-transparent">·</div>
            <button
              onClick={() => onAddBar()}
              className="w-full h-14 rounded-lg border border-dashed border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 text-xl font-light transition-all flex items-center justify-center"
            >
              +
            </button>
          </div>
        )}

        {chordPicker && <div className="col-span-4 h-52" />}
        {notePicker  && <div className="col-span-4 h-[78vh]" />}
      </div>
    )
  }

  return (
    <>
      {isStrum ? renderStrum() : renderFingerpicking()}

      {chordPicker && (
        <ChordCellPicker
          key={chordPicker.chordIdx}
          slot={chordPicker.slot}
          isStrum={chordPicker.isStrum}
          timeSig={timeSig}
          onSelect={slot => onChordChange(chordPicker.chordIdx, slot)}
          onFillBar={onFillBarAt ? slots => onFillBarAt(chordPicker.chordIdx, slots) : undefined}
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
