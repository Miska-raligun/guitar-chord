import { describe, it, expect } from 'vitest'
import { parseMidi } from './midiImport'

// 手工构造最小 MIDI（单轨、PPQ=480），验证解析器读出速度/拍号/音符位置
function vlq(n: number): number[] {
  const out = [n & 0x7f]
  n >>= 7
  while (n > 0) { out.unshift((n & 0x7f) | 0x80); n >>= 7 }
  return out
}
function chunk(id: string, body: number[]): number[] {
  const len = body.length
  return [...id.split('').map(c => c.charCodeAt(0)),
          (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff,
          ...body]
}

function buildMidi(opts: { bpm: number; notes: { at: number; dur: number; note: number }[] }): ArrayBuffer {
  const PPQ = 480
  const us = Math.round(60_000_000 / opts.bpm)
  const head = chunk('MThd', [0,0, 0,1, (PPQ >> 8) & 0xff, PPQ & 0xff])

  const track: number[] = [
    ...vlq(0), 0xff, 0x58, 4, 4, 2, 24, 8,                                    // 4/4
    ...vlq(0), 0xff, 0x51, 3, (us >>> 16) & 0xff, (us >>> 8) & 0xff, us & 0xff,
  ]
  // 事件按绝对 tick 排序后转 delta
  const evts: { tick: number; bytes: number[] }[] = []
  for (const n of opts.notes) {
    evts.push({ tick: n.at,         bytes: [0x90, n.note, 100] })
    evts.push({ tick: n.at + n.dur, bytes: [0x80, n.note, 0] })
  }
  evts.sort((a, b) => a.tick - b.tick)
  let last = 0
  for (const e of evts) {
    track.push(...vlq(e.tick - last), ...e.bytes)
    last = e.tick
  }
  track.push(...vlq(0), 0xff, 0x2f, 0)

  const bytes = [...head, ...chunk('MTrk', track)]
  return new Uint8Array(bytes).buffer
}

describe('parseMidi', () => {
  it('读出速度与拍号', () => {
    const r = parseMidi(buildMidi({ bpm: 120, notes: [{ at: 0, dur: 480, note: 60 }] }))!
    expect(r).not.toBeNull()
    expect(r.bpm).toBe(120)
    expect(r.timeSig).toBe('4/4')
  })

  it('音符落在正确的小节与主槽位', () => {
    // PPQ=480, 4/4 → 每小节 1920 ticks, 每主槽 120 ticks
    const r = parseMidi(buildMidi({ bpm: 80, notes: [
      { at: 0,    dur: 480, note: 60 },   // 第1小节 槽0，C
      { at: 960,  dur: 240, note: 67 },   // 第1小节 槽8，G
      { at: 1920, dur: 480, note: 64 },   // 第2小节 槽0，E
    ]}))!
    expect(r.melody).toHaveLength(2)
    expect(r.melody[0][0]).toMatchObject({ semitone: 0, duration: 4 })   // 480/120=4
    expect(r.melody[0][8]).toMatchObject({ semitone: 7, duration: 2 })
    expect(r.melody[1][0]).toMatchObject({ semitone: 4, duration: 4 })
  })

  it('同一位置多音取最高音（单声部化）', () => {
    const r = parseMidi(buildMidi({ bpm: 80, notes: [
      { at: 0, dur: 480, note: 60 },   // C
      { at: 0, dur: 480, note: 67 },   // G（更高）
    ]}))!
    expect(r.melody[0][0]?.semitone).toBe(7)
  })

  it('和弦槽数量与小节数一致且为空', () => {
    const r = parseMidi(buildMidi({ bpm: 80, notes: [{ at: 3840, dur: 480, note: 60 }] }))!
    expect(r.chords).toHaveLength(r.melody.length)
    expect(r.chords.every(c => c.root === null)).toBe(true)
  })

  it('多声道时选中最接近单声部的那一路（我们导出的 MIDI：和弦 ch0、旋律 ch1）', () => {
    const PPQ = 480
    const us = Math.round(60_000_000 / 80)
    const head = chunk('MThd', [0,0, 0,1, (PPQ >> 8) & 0xff, PPQ & 0xff])
    const track: number[] = [
      ...vlq(0), 0xff, 0x58, 4, 4, 2, 24, 8,
      ...vlq(0), 0xff, 0x51, 3, (us >>> 16) & 0xff, (us >>> 8) & 0xff, us & 0xff,
    ]
    // ch0：同一时刻三个和弦音（复音）；ch1：单音旋律
    const evts: { tick: number; bytes: number[] }[] = []
    for (const n of [48, 52, 55]) {
      evts.push({ tick: 0,   bytes: [0x90, n, 90] })
      evts.push({ tick: 480, bytes: [0x80, n, 0] })
    }
    evts.push({ tick: 0,   bytes: [0x91, 72, 100] })   // ch1 单音 C5
    evts.push({ tick: 240, bytes: [0x81, 72, 0] })
    evts.sort((a, b) => a.tick - b.tick)
    let last = 0
    for (const e of evts) { track.push(...vlq(e.tick - last), ...e.bytes); last = e.tick }
    track.push(...vlq(0), 0xff, 0x2f, 0)

    const r = parseMidi(new Uint8Array([...head, ...chunk('MTrk', track)]).buffer)!
    // 选中 ch1 → 槽0 是 C(0)，而不是和弦最高音 G(7)
    expect(r.melody[0][0]).toMatchObject({ semitone: 0, duration: 2 })
  })

  it('非法输入返回 null', () => {
    expect(parseMidi(new Uint8Array([1,2,3]).buffer)).toBeNull()
    expect(parseMidi(new Uint8Array(20).buffer)).toBeNull()
  })
})
