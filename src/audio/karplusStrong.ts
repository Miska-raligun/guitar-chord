import audioEngine from './AudioEngine'

// All active source nodes — tracked so stopAllNodes() can cancel them
const activeNodes = new Set<AudioBufferSourceNode>()

export function stopAllNodes(): void {
  for (const node of activeNodes) {
    try { node.stop() } catch { /* already ended */ }
  }
  activeNodes.clear()
}

function buildBuffer(freq: number, durationSec: number): AudioBuffer {
  const ctx = audioEngine.getContext()
  const sampleRate = ctx.sampleRate
  const totalSamples = Math.floor(sampleRate * durationSec)
  const N = Math.round(sampleRate / freq)

  const delay = new Float32Array(N)
  for (let i = 0; i < N; i++) delay[i] = Math.random() * 2 - 1

  const out = new Float32Array(totalSamples)
  for (let i = 0; i < totalSamples; i++) {
    const idx = i % N
    const next = 0.5 * (delay[idx] + delay[(idx + 1) % N])
    delay[idx] = next * 0.998
    out[i] = next
  }

  const buf = ctx.createBuffer(1, totalSamples, sampleRate)
  buf.copyToChannel(out, 0)
  return buf
}

export function pluckStringAt(freq: number, time: number, volume = 0.7): void {
  const ctx = audioEngine.getContext()
  const gainNode = ctx.createGain()
  gainNode.gain.value = volume
  gainNode.connect(audioEngine.getMasterGain())

  const source = ctx.createBufferSource()
  source.buffer = buildBuffer(freq, 2.2)
  source.connect(gainNode)
  source.start(time)

  activeNodes.add(source)
  source.onended = () => {
    gainNode.disconnect()
    activeNodes.delete(source)
  }
}

export function pluckString(freq: number, volume = 0.8): void {
  pluckStringAt(freq, audioEngine.getContext().currentTime, volume)
}
