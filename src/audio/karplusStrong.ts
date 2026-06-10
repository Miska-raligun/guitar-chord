import audioEngine from './AudioEngine'

// Karplus-Strong plucked string synthesis.
// Computes the waveform offline then plays it via AudioBufferSourceNode.
export function pluckString(freq: number, durationSec = 2.5, volume = 0.8): void {
  const ctx = audioEngine.getContext()
  const sampleRate = ctx.sampleRate
  const totalSamples = Math.floor(sampleRate * durationSec)
  const N = Math.round(sampleRate / freq)

  const delay = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    delay[i] = Math.random() * 2 - 1
  }

  const outBuffer = new Float32Array(totalSamples)
  for (let i = 0; i < totalSamples; i++) {
    const idx = i % N
    const next = 0.5 * (delay[idx] + delay[(idx + 1) % N])
    delay[idx] = next * 0.998
    outBuffer[i] = next
  }

  const audioBuffer = ctx.createBuffer(1, totalSamples, sampleRate)
  audioBuffer.copyToChannel(outBuffer, 0)

  const gainNode = ctx.createGain()
  gainNode.gain.value = volume
  gainNode.connect(audioEngine.getMasterGain())

  const source = ctx.createBufferSource()
  source.buffer = audioBuffer
  source.connect(gainNode)
  source.start()
  source.onended = () => gainNode.disconnect()
}

export function pluckStringAt(freq: number, time: number, volume = 0.7): void {
  const ctx = audioEngine.getContext()
  const sampleRate = ctx.sampleRate
  const durationSec = 2.0
  const totalSamples = Math.floor(sampleRate * durationSec)
  const N = Math.round(sampleRate / freq)

  const delay = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    delay[i] = Math.random() * 2 - 1
  }

  const outBuffer = new Float32Array(totalSamples)
  for (let i = 0; i < totalSamples; i++) {
    const idx = i % N
    const next = 0.5 * (delay[idx] + delay[(idx + 1) % N])
    delay[idx] = next * 0.998
    outBuffer[i] = next
  }

  const audioBuffer = ctx.createBuffer(1, totalSamples, sampleRate)
  audioBuffer.copyToChannel(outBuffer, 0)

  const gainNode = ctx.createGain()
  gainNode.gain.value = volume
  gainNode.connect(audioEngine.getMasterGain())

  const source = ctx.createBufferSource()
  source.buffer = audioBuffer
  source.connect(gainNode)
  source.start(time)
  source.onended = () => gainNode.disconnect()
}
