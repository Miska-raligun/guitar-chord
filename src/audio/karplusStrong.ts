import audioEngine from './AudioEngine'
import type { ChordPosition } from '../types/chord'
import { OPEN_STRING_FREQS } from '../types/chord'

const activeNodes = new Set<AudioBufferSourceNode>()

export function stopAllNodes(): void {
  for (const node of activeNodes) {
    try { node.stop() } catch { /* already ended */ }
  }
  activeNodes.clear()
}

function buildKSBuffer(freq: number, durationSec: number, decayFactor: number): AudioBuffer {
  const ctx = audioEngine.getContext()
  const sr = ctx.sampleRate
  const N = Math.max(2, Math.round(sr / freq))
  const total = Math.floor(sr * durationSec)

  const delay = new Float32Array(N)
  for (let i = 0; i < N; i++) delay[i] = Math.random() * 2 - 1

  const out = new Float32Array(total)
  for (let i = 0; i < total; i++) {
    const idx = i % N
    const next = 0.5 * (delay[idx] + delay[(idx + 1) % N])
    delay[idx] = next * decayFactor
    out[i] = next
  }

  const buf = ctx.createBuffer(1, total, sr)
  buf.copyToChannel(out, 0)
  return buf
}

function fireAt(buf: AudioBuffer, time: number, volume: number): void {
  const ctx = audioEngine.getContext()
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

// 普通拨弦（自然衰减）
export function pluckStringAt(freq: number, time: number, volume = 0.7): void {
  fireAt(buildKSBuffer(freq, 2.2, 0.998), time, volume)
}

export function pluckString(freq: number, volume = 0.8): void {
  pluckStringAt(freq, audioEngine.getContext().currentTime, volume)
}

// 闷弦（x, 快速衰减模拟切音）
export function pluckMutedAt(freq: number, time: number, volume = 0.5): void {
  fireAt(buildKSBuffer(freq, 0.15, 0.88), time, volume)
}

// 对整个和弦做闷弦扫（x节拍）
export function strumMutedAt(position: ChordPosition, time: number): void {
  const sweepDelay = 0.008  // 8ms/弦，比普通扫弦更紧密
  position.frets.forEach((fret, strIndex) => {
    if (fret === -1) return
    const freq = OPEN_STRING_FREQS[strIndex] * Math.pow(2, fret / 12)
    pluckMutedAt(freq, time + strIndex * sweepDelay, 0.45)
  })
}
