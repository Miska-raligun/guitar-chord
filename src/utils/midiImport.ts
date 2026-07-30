import type { ChordSlot, MelodyNote, TimeSig } from '../types/audio'
import { getMasterSlotsPerBar, MASTER_SLOTS } from './sequencerUtils'

// 最小 MIDI 解析：读出速度、拍号和音符，映射到编曲的主网格。
// 只取单声部旋律（同一时刻取最高音），和弦轨忽略——用于把外部旋律导入后再配和弦。

export interface MidiImportResult {
  bpm: number
  timeSig: TimeSig
  chords: ChordSlot[]
  melody: (MelodyNote | null)[][]
}

interface RawNote { tick: number; durTicks: number; note: number; channel: number }

// 多声道文件里挑出最像旋律的那一路：以"音符数 / 不同起始时刻数"作为复音度，
// 取复音度最低（最接近单声部）的声道。我们自己导出的 MIDI 里和弦在 ch0、
// 旋律在 ch1，这个规则能正确选中旋律。
function pickMelodyChannel(notes: RawNote[]): number | null {
  const byCh = new Map<number, RawNote[]>()
  for (const n of notes) {
    const arr = byCh.get(n.channel)
    if (arr) arr.push(n); else byCh.set(n.channel, [n])
  }
  if (byCh.size <= 1) return null
  let best: number | null = null
  let bestScore = Infinity
  for (const [ch, arr] of byCh) {
    const onsets = new Set(arr.map(n => n.tick)).size
    const poly = arr.length / Math.max(1, onsets)
    if (poly < bestScore) { bestScore = poly; best = ch }
  }
  return best
}

function readVlq(v: DataView, pos: number): { value: number; next: number } {
  let value = 0
  let p = pos
  for (;;) {
    const b = v.getUint8(p++)
    value = (value << 7) | (b & 0x7f)
    if ((b & 0x80) === 0) break
  }
  return { value, next: p }
}

export function parseMidi(buf: ArrayBuffer): MidiImportResult | null {
  const v = new DataView(buf)
  if (buf.byteLength < 14) return null
  // MThd
  if (String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3)) !== 'MThd') return null
  const ppq = v.getUint16(12)
  if (!ppq || ppq & 0x8000) return null   // 不支持 SMPTE 时间码

  let bpm = 80
  let tsNum = 4
  let tsDen = 4
  const notes: RawNote[] = []

  let pos = 8 + v.getUint32(4)
  while (pos + 8 <= buf.byteLength) {
    const id = String.fromCharCode(v.getUint8(pos), v.getUint8(pos+1), v.getUint8(pos+2), v.getUint8(pos+3))
    const len = v.getUint32(pos + 4)
    const end = Math.min(pos + 8 + len, buf.byteLength)
    if (id !== 'MTrk') { pos = end; continue }

    let p = pos + 8
    let tick = 0
    let running = 0
    const open = new Map<number, number>()   // note → onset tick

    while (p < end) {
      const d = readVlq(v, p); tick += d.value; p = d.next
      if (p >= end) break
      let status = v.getUint8(p)
      if (status & 0x80) { p++; running = status } else { status = running }

      if (status === 0xff) {              // meta
        const type = v.getUint8(p++)
        const l = readVlq(v, p); p = l.next
        if (type === 0x51 && l.value === 3) {
          const us = (v.getUint8(p) << 16) | (v.getUint8(p+1) << 8) | v.getUint8(p+2)
          if (us > 0) bpm = Math.max(40, Math.min(200, Math.round(60_000_000 / us)))
        } else if (type === 0x58 && l.value >= 2) {
          tsNum = v.getUint8(p)
          tsDen = Math.pow(2, v.getUint8(p + 1))
        }
        p += l.value
      } else if (status === 0xf0 || status === 0xf7) {   // sysex
        const l = readVlq(v, p); p = l.next + l.value
      } else {
        const hi = status & 0xf0
        if (hi === 0x90 || hi === 0x80) {
          const note = v.getUint8(p)
          const vel  = v.getUint8(p + 1)
          p += 2
          if (hi === 0x90 && vel > 0) {
            open.set(note, tick)
          } else {
            const on = open.get(note)
            if (on !== undefined) {
              notes.push({ tick: on, durTicks: Math.max(1, tick - on), note, channel: status & 0x0f })
              open.delete(note)
            }
          }
        } else if (hi === 0xc0 || hi === 0xd0) { p += 1 }
        else { p += 2 }
      }
    }
    pos = end
  }

  if (notes.length === 0) return null

  const melCh = pickMelodyChannel(notes)
  const useNotes = melCh === null ? notes : notes.filter(n => n.channel === melCh)

  const timeSig: TimeSig =
    tsNum === 3 && tsDen === 4 ? '3/4' :
    tsNum === 6 && tsDen === 8 ? '6/8' :
    tsNum === 2 && tsDen === 4 ? '2/4' : '4/4'

  const master        = getMasterSlotsPerBar(timeSig)
  const ticksPerBar   = ppq * tsNum * (4 / tsDen)
  const ticksPerSlot  = ticksPerBar / master

  // 同一格只留最高音（简化为单声部旋律）
  const lastTick = Math.max(...useNotes.map(n => n.tick + n.durTicks))
  const numBars  = Math.max(1, Math.min(64, Math.ceil(lastTick / ticksPerBar)))
  const melody: (MelodyNote | null)[][] = Array.from({ length: numBars }, () => Array(MASTER_SLOTS).fill(null))

  for (const n of useNotes) {
    const globalSlot = Math.round(n.tick / ticksPerSlot)
    const bar  = Math.floor(globalSlot / master)
    const slot = globalSlot % master
    if (bar >= numBars) continue
    const duration = Math.max(1, Math.min(master, Math.round(n.durTicks / ticksPerSlot)))
    const semitone = ((n.note % 12) + 12) % 12
    const existing = melody[bar][slot]
    if (!existing || n.note % 12 > existing.semitone) {
      melody[bar][slot] = { semitone, duration }
    }
  }

  const chords: ChordSlot[] = Array.from({ length: numBars }, () => ({ root: null, suffix: null, positionIndex: 0 }))
  return { bpm, timeSig, chords, melody }
}

export function readMidiFile(file: File): Promise<MidiImportResult | null> {
  return new Promise(resolve => {
    const r = new FileReader()
    r.onload = () => {
      try { resolve(parseMidi(r.result as ArrayBuffer)) } catch { resolve(null) }
    }
    r.onerror = () => resolve(null)
    r.readAsArrayBuffer(file)
  })
}
