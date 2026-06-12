import audioEngine from './AudioEngine'
import type { ChordPosition } from '../types/chord'
import { OPEN_STRING_FREQS } from '../types/chord'
import { getToneConfig, computeKsParams } from './toneConfig'

const activeNodes = new Set<AudioBufferSourceNode>()

export function stopAllNodes(): void {
  for (const node of activeNodes) {
    try { node.stop() } catch { /* already ended */ }
  }
  activeNodes.clear()
}

// ── Offline waveshaping ───────────────────────────────────────────────────────

function applyDrive(out: Float32Array, amount: number): void {
  if (amount <= 0) return
  const preGain = 1 + amount * 9
  if (amount < 0.5) {
    // Soft overdrive — tanh saturation
    const norm = Math.tanh(preGain * 0.6) || 1
    for (let i = 0; i < out.length; i++) {
      out[i] = Math.tanh(out[i] * preGain) / norm
    }
  } else {
    // Hard distortion — asymmetric clipping
    const clip = 0.5 - (amount - 0.5) * 0.25
    const norm = clip
    for (let i = 0; i < out.length; i++) {
      out[i] = Math.max(-clip, Math.min(clip, out[i] * preGain)) / norm
    }
  }
}

// Simple 1-pole lowpass to tame harsh harmonics after distortion
function applyLowpass(out: Float32Array, cutoffHz: number, sampleRate: number): void {
  if (cutoffHz <= 0) return
  const a = Math.exp(-2 * Math.PI * (cutoffHz / sampleRate))
  let y = 0
  for (let i = 0; i < out.length; i++) {
    y = (1 - a) * out[i] + a * y
    out[i] = y
  }
}

// ── Karplus-Strong synthesis ──────────────────────────────────────────────────

function buildKSBuffer(freq: number, durationSec: number): AudioBuffer {
  const params = computeKsParams(getToneConfig())
  const { loopFilterA, decay, driveAmount, lpCutoff } = params

  const ctx = audioEngine.getContext()
  const sr  = ctx.sampleRate
  const N   = Math.max(2, Math.round(sr / freq))
  const total = Math.floor(sr * durationSec)

  const delay = new Float32Array(N)
  for (let i = 0; i < N; i++) delay[i] = Math.random() * 2 - 1

  const out = new Float32Array(total)
  const b = loopFilterA
  const c = 1 - loopFilterA

  for (let i = 0; i < total; i++) {
    const idx  = i % N
    const next = b * delay[idx] + c * delay[(idx + 1) % N]
    delay[idx] = next * decay
    out[i] = next
  }

  applyDrive(out, driveAmount)
  applyLowpass(out, lpCutoff, sr)

  // Fade out the last 25% — prevents abrupt cutoff and reduces overlap buildup
  const fadeStart = Math.floor(total * 0.75)
  for (let i = fadeStart; i < total; i++) {
    const t = (i - fadeStart) / (total - fadeStart)
    out[i] *= (1 - t) * (1 - t)
  }

  const buf = ctx.createBuffer(1, total, sr)
  buf.copyToChannel(out, 0)
  return buf
}

function buildKSBufferMuted(freq: number): AudioBuffer {
  // Muted/chucked string — always acoustic-style (short, percussive)
  const ctx = audioEngine.getContext()
  const sr  = ctx.sampleRate
  const N   = Math.max(2, Math.round(sr / freq))
  const total = Math.floor(sr * 0.15)

  const delay = new Float32Array(N)
  for (let i = 0; i < N; i++) delay[i] = Math.random() * 2 - 1

  const out = new Float32Array(total)
  for (let i = 0; i < total; i++) {
    const idx  = i % N
    const next = 0.5 * (delay[idx] + delay[(idx + 1) % N])
    delay[idx] = next * 0.88
    out[i] = next
  }

  const buf = ctx.createBuffer(1, total, sr)
  buf.copyToChannel(out, 0)
  return buf
}

// ── Playback ──────────────────────────────────────────────────────────────────

function fireAt(buf: AudioBuffer, time: number, volume: number): void {
  const ctx  = audioEngine.getContext()
  const gain = ctx.createGain()
  gain.gain.value = volume
  gain.connect(audioEngine.getMasterGain())

  const src = ctx.createBufferSource()
  src.buffer = buf
  src.connect(gain)
  src.start(time)

  activeNodes.add(src)
  src.onended = () => {
    gain.disconnect()
    activeNodes.delete(src)
  }
}

export function pluckStringAt(freq: number, time: number, volume = 0.7): void {
  const cfg = getToneConfig()
  const dur = cfg.mode === 'electric'
    ? (cfg.effect === 'distortion' ? 0.7 : cfg.effect === 'overdrive' ? 1.2 : 2.0)
    : 2.2
  fireAt(buildKSBuffer(freq, dur), time, volume)
}

export function pluckString(freq: number, volume = 0.8): void {
  pluckStringAt(freq, audioEngine.getContext().currentTime, volume)
}

export function pluckMutedAt(freq: number, time: number, volume = 0.5): void {
  fireAt(buildKSBufferMuted(freq), time, volume)
}

export function strumMutedAt(position: ChordPosition, time: number): void {
  const sweepDelay = 0.008
  position.frets.forEach((fret, strIndex) => {
    if (fret === -1) return
    const freq = OPEN_STRING_FREQS[strIndex] * Math.pow(2, fret / 12)
    pluckMutedAt(freq, time + strIndex * sweepDelay, 0.45)
  })
}
