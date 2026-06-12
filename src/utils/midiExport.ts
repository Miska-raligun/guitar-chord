import type { ChordSlot, MelodyNote } from '../types/audio'

const PPQ = 480  // ticks per quarter note

const CHORD_INTERVALS: Record<string, number[]> = {
  major:  [0, 4, 7],
  minor:  [0, 3, 7],
  '7':    [0, 4, 7, 10],
  maj7:   [0, 4, 7, 11],
  m7:     [0, 3, 7, 10],
  sus2:   [0, 2, 7],
  sus4:   [0, 5, 7],
  dim:    [0, 3, 6],
  aug:    [0, 4, 8],
  add9:   [0, 2, 4, 7],
  '6':    [0, 4, 7, 9],
  m6:     [0, 3, 7, 9],
  dim7:   [0, 3, 6, 9],
  'm7b5': [0, 3, 6, 10],
}

const ROOT_SEMITONE: Record<string, number> = {
  C: 0, 'C#': 1, D: 2, Eb: 3, E: 4, F: 5,
  'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11,
}

// ── binary helpers ──────────────────────────────────────────────────────────

function vlq(n: number): number[] {
  if (n === 0) return [0]
  const bytes: number[] = []
  bytes.unshift(n & 0x7f)
  n >>>= 7
  while (n > 0) { bytes.unshift((n & 0x7f) | 0x80); n >>>= 7 }
  return bytes
}

function u32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
}
function u16(n: number): number[] { return [(n >>> 8) & 0xff, n & 0xff] }

function buildChunk(tag: string, data: number[]): number[] {
  return [...tag.split('').map(c => c.charCodeAt(0)), ...u32(data.length), ...data]
}

// ── note events ─────────────────────────────────────────────────────────────

interface NoteEvent { tick: number; on: boolean; channel: number; note: number; velocity: number }

function eventsToBytes(events: NoteEvent[]): number[] {
  events.sort((a, b) => a.tick - b.tick || (a.on ? 1 : -1))
  const bytes: number[] = []
  let cursor = 0
  for (const ev of events) {
    bytes.push(...vlq(ev.tick - cursor))
    cursor = ev.tick
    bytes.push((ev.on ? 0x90 : 0x80) | ev.channel, ev.note, ev.velocity)
  }
  bytes.push(0, 0xff, 0x2f, 0)  // end of track
  return bytes
}

// ── main export ─────────────────────────────────────────────────────────────

export interface MidiExportInput {
  bpm: number
  timeSig: string
  chords: ChordSlot[]
  melody: (MelodyNote | null)[][]
}

export function exportMidi({ bpm, timeSig, chords, melody }: MidiExportInput): void {
  const [tsNum, tsDen] = timeSig.split('/').map(Number)
  const ticksPerBar   = PPQ * tsNum
  const masterSlots   = timeSig === '4/4' ? 16 : timeSig === '2/4' ? 8 : 12
  const tSlot         = Math.round(ticksPerBar / masterSlots)

  // ── tempo track ─────────────────────────────────────────────────────────
  const us = Math.round(60_000_000 / bpm)
  const tsDenPow = Math.round(Math.log2(tsDen))
  const tempoBytes: number[] = [
    ...vlq(0), 0xff, 0x58, 4, tsNum, tsDenPow, 24, 8,
    ...vlq(0), 0xff, 0x51, 3, (us >>> 16) & 0xff, (us >>> 8) & 0xff, us & 0xff,
    0, 0xff, 0x2f, 0,
  ]

  // ── note events ─────────────────────────────────────────────────────────
  const events: NoteEvent[] = []

  // Expand chord slots into physical bars
  const physChords: ChordSlot[] = []
  chords.forEach(slot => {
    const bars = slot.bars ?? 1
    for (let b = 0; b < bars; b++) physChords.push(slot)
  })

  // Chord track (channel 0): voiced arpeggio, held for the whole bar
  physChords.forEach((slot, bar) => {
    if (!slot.root || !slot.suffix) return
    const root      = ROOT_SEMITONE[slot.root] ?? 0
    const intervals = CHORD_INTERVALS[slot.suffix] ?? CHORD_INTERVALS.major
    const barStart  = bar * ticksPerBar
    intervals.forEach((iv, i) => {
      const octave  = i === 0 ? 3 : 4
      const note    = 12 * octave + ((root + iv) % 12)
      const onTick  = barStart + i * 5        // slight arpeggio
      const offTick = barStart + ticksPerBar - 10
      events.push({ tick: onTick,  on: true,  channel: 0, note, velocity: i === 0 ? 90 : 70 })
      events.push({ tick: offTick, on: false, channel: 0, note, velocity: 0 })
    })
  })

  // Melody track (channel 1): exact slot positions, C4 octave
  melody.forEach((bar, barIdx) => {
    const barStart = barIdx * ticksPerBar
    bar.forEach((note, slot) => {
      if (!note) return
      const midiNote = 60 + note.semitone
      const onTick   = barStart + slot * tSlot
      const offTick  = onTick + Math.max(tSlot, note.duration * tSlot) - 10
      events.push({ tick: onTick,  on: true,  channel: 1, note: midiNote, velocity: 100 })
      events.push({ tick: offTick, on: false, channel: 1, note: midiNote, velocity: 0 })
    })
  })

  // ── assemble & download ─────────────────────────────────────────────────
  const bytes = [
    ...buildChunk('MThd', [...u16(1), ...u16(2), ...u16(PPQ)]),
    ...buildChunk('MTrk', tempoBytes),
    ...buildChunk('MTrk', eventsToBytes(events)),
  ]

  const blob = new Blob([new Uint8Array(bytes)], { type: 'audio/midi' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `guitar-chord-${new Date().toISOString().slice(0, 10)}.mid`
  a.click()
  URL.revokeObjectURL(url)
}
