const FFT_SIZE = 8192
const GUITAR_LOW_HZ = 75.0
const GUITAR_HIGH_HZ = 1400.0
const NOISE_FLOOR_DB = -75

export function extractChromagram(freqData: Float32Array<ArrayBufferLike>, sampleRate: number): Float32Array<ArrayBuffer> {
  const binHz = sampleRate / FFT_SIZE
  const lowBin = Math.max(1, Math.ceil(GUITAR_LOW_HZ / binHz))
  const highBin = Math.min(freqData.length - 1, Math.floor(GUITAR_HIGH_HZ / binHz))

  const chromagram = new Float32Array(12) as Float32Array<ArrayBuffer>
  chromagram.fill(0)

  for (let bin = lowBin; bin <= highBin; bin++) {
    const dBFS = freqData[bin]
    if (dBFS < NOISE_FLOOR_DB) continue
    const magnitude = Math.pow(10, dBFS / 20)
    const freq = bin * binHz
    const midi = 12 * Math.log2(freq / 440) + 69
    const pc = ((Math.round(midi) % 12) + 12) % 12
    chromagram[pc] += magnitude
  }

  const max = Math.max(...chromagram)
  if (max > 0) {
    for (let i = 0; i < 12; i++) chromagram[i] /= max
  }

  return chromagram
}
