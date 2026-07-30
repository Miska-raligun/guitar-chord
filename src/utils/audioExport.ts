import { renderKSSamples, pluckDuration } from '../audio/karplusStrong'
import type { ChordPosition } from '../types/chord'
import type { ChordSlot, MelodyNote, SequencerState, TimeSig } from '../types/audio'
import {
  getPatternSteps, getStepsPerBar, getMasterSlotsPerBar, getChordMasterDuration,
  getMasterSPerStep, getFreq, getBassString, semitoneToFreq,
  BASS, MUTE_BASS, REST, STRUM_DOWN, STRUM_UP, STRUM_MUTE,
} from './sequencerUtils'
import type { PatternStep } from './sequencerUtils'

// 离线渲染整首编曲为 WAV。复用与实时播放相同的 Karplus-Strong 合成与
// 事件时间轴，因此导出结果和听到的一致（闷音扫弦除外：按普通短音处理）。

const SAMPLE_RATE = 44100
const BASS_VOL   = 0.88
const TREBLE_VOL = 0.55
const SWEEP_DUR  = 0.055
const TAIL_S     = 1.5   // 结尾留白，让最后的音自然衰减

export interface AudioExportInput {
  bpm: number
  pattern: SequencerState['pattern']
  timeSig: TimeSig
  capo: number
  chords: ChordSlot[]
  melody: (MelodyNote | null)[][]
  getPosition: (slot: ChordSlot) => ChordPosition | null
}

function mixInto(target: Float32Array, src: Float32Array, offset: number, gain: number): void {
  const start = Math.max(0, Math.round(offset))
  const n = Math.min(src.length, target.length - start)
  for (let i = 0; i < n; i++) target[start + i] += src[i] * gain
}

export function renderCompositionToWav(input: AudioExportInput): Blob {
  const { bpm, pattern, timeSig, capo, chords, melody, getPosition } = input
  const master     = getMasterSlotsPerBar(timeSig)
  const sPerMaster = getMasterSPerStep(bpm)
  const isStrum    = pattern === 'strum'
  const steps      = getPatternSteps(pattern)
  const arpEvery   = master / getStepsPerBar(pattern, timeSig)
  const capoScale  = Math.pow(2, capo / 12)
  const dur        = pluckDuration()

  // 事件时间轴（与调度器一致）
  let cumSlots = 0
  const starts: number[] = []
  for (const c of chords) {
    starts.push(cumSlots)
    cumSlots += isStrum ? getChordMasterDuration(c, timeSig) : master
  }
  const totalSlots = cumSlots || master
  const totalSec   = totalSlots * sPerMaster + TAIL_S
  const out = new Float32Array(Math.ceil(totalSec * SAMPLE_RATE))

  // 单音缓存：同一频率的拨弦只合成一次
  const cache = new Map<number, Float32Array>()
  function samplesFor(freq: number): Float32Array {
    const key = Math.round(freq * 100)
    let s = cache.get(key)
    if (!s) { s = renderKSSamples(freq, dur, SAMPLE_RATE); cache.set(key, s) }
    return s
  }
  function pluck(freq: number, atSec: number, vol: number): void {
    mixInto(out, samplesFor(freq * capoScale), atSec * SAMPLE_RATE, vol)
  }

  function renderStep(step: PatternStep, atSec: number, isBass: boolean, pos: ChordPosition): void {
    if (step === REST) return
    if (step === STRUM_MUTE) {
      // 闷音：短促的低音量扫弦
      pos.frets.forEach((fret, si) => {
        if (fret === -1) return
        const f = getFreq(pos, si)
        if (f !== null) mixInto(out, renderKSSamples(f * capoScale, 0.15, SAMPLE_RATE), (atSec + si * 0.008) * SAMPLE_RATE, 0.45)
      })
      return
    }
    if (step === STRUM_DOWN || step === STRUM_UP) {
      const order = step === STRUM_DOWN ? [0,1,2,3,4,5] : [5,4,3,2,1,0]
      order.forEach((si, i) => {
        const f = getFreq(pos, si)
        if (f !== null) pluck(f, atSec + i * (SWEEP_DUR / 5), 0.78)
      })
      return
    }
    if (step === BASS || step === MUTE_BASS) {
      const f = getFreq(pos, getBassString(pos))
      if (f !== null) pluck(f, atSec, BASS_VOL)
      return
    }
    if (Array.isArray(step)) {
      step.forEach(si => {
        const f = getFreq(pos, si)
        if (f !== null) pluck(f, atSec, TREBLE_VOL * 1.1)
      })
      return
    }
    const f = getFreq(pos, step)
    if (f !== null) pluck(f, atSec, isBass ? BASS_VOL : TREBLE_VOL)
  }

  for (let slot = 0; slot < totalSlots; slot++) {
    const atSec = slot * sPerMaster
    let chordIdx = 0
    for (let i = chords.length - 1; i >= 0; i--) {
      if (slot >= starts[i]) { chordIdx = i; break }
    }
    const posInChord = slot - starts[chordIdx]
    const pos = getPosition(chords[chordIdx])

    if (pos) {
      if (isStrum) {
        if (posInChord === 0) {
          const dir = chords[chordIdx].strumDir ?? 'D'
          renderStep(dir === 'U' ? STRUM_UP : dir === 'X' ? STRUM_MUTE : STRUM_DOWN, atSec, true, pos)
        }
      } else if (posInChord % arpEvery === 0) {
        const arpStep = Math.round(posInChord / arpEvery)
        renderStep(steps[arpStep % steps.length], atSec, arpStep === 0, pos)
      }
    }

    const note = melody[chordIdx]?.[posInChord]
    if (note) pluck(semitoneToFreq(note.semitone), atSec + 0.005, 0.85)
  }

  // 归一化，避免叠加削顶
  let peak = 0
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]))
  const norm = peak > 0.99 ? 0.99 / peak : 1

  return encodeWav(out, norm, SAMPLE_RATE)
}

function encodeWav(samples: Float32Array, gain: number, sampleRate: number): Blob {
  const n = samples.length
  const buf = new ArrayBuffer(44 + n * 2)
  const view = new DataView(buf)
  const wstr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }

  wstr(0, 'RIFF')
  view.setUint32(4, 36 + n * 2, true)
  wstr(8, 'WAVE')
  wstr(12, 'fmt ')
  view.setUint32(16, 16, true)      // PCM chunk size
  view.setUint16(20, 1, true)       // PCM
  view.setUint16(22, 1, true)       // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)  // byte rate
  view.setUint16(32, 2, true)       // block align
  view.setUint16(34, 16, true)      // bits per sample
  wstr(36, 'data')
  view.setUint32(40, n * 2, true)

  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i] * gain))
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true)
  }
  return new Blob([buf], { type: 'audio/wav' })
}

export function downloadWav(input: AudioExportInput, filename = 'composition.wav'): void {
  const blob = renderCompositionToWav(input)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
