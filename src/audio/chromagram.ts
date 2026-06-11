const FFT_SIZE = 8192
const GUITAR_LOW_HZ  = 75.0
const GUITAR_HIGH_HZ = 1400.0
// Below this absolute peak → no guitar signal → return zeros so caller detects silence.
// Keep this generous: typical laptop mics peak around -55 to -70 dBFS for an acoustic
// guitar, and the analyser's smoothing lowers peaks further. -50 silenced real playing.
const ABS_SIGNAL_THRESHOLD_DB = -70
// Ignore bins more than this many dB below the peak in-range bin
const REL_NOISE_FLOOR_DB = 42

export function extractChromagram(freqData: Float32Array<ArrayBufferLike>, sampleRate: number): Float32Array<ArrayBuffer> {
  const binHz  = sampleRate / FFT_SIZE
  const lowBin  = Math.max(1, Math.ceil(GUITAR_LOW_HZ  / binHz))
  const highBin = Math.min(freqData.length - 1, Math.floor(GUITAR_HIGH_HZ / binHz))

  // Find the loudest bin in the guitar range
  let peakDb = -Infinity
  for (let bin = lowBin; bin <= highBin; bin++) {
    if (freqData[bin] > peakDb) peakDb = freqData[bin]
  }

  // No meaningful signal — return zeros so caller's energy check detects silence
  if (peakDb < ABS_SIGNAL_THRESHOLD_DB) return new Float32Array(12) as Float32Array<ArrayBuffer>

  // Dynamic noise floor relative to the loudest bin
  const noiseFloor = peakDb - REL_NOISE_FLOOR_DB

  const chroma = new Float32Array(12) as Float32Array<ArrayBuffer>

  for (let bin = lowBin; bin <= highBin; bin++) {
    const dB = freqData[bin]
    if (dB < noiseFloor) continue

    // Magnitude relative to peak (peak bin = 1.0)
    const mag  = Math.pow(10, (dB - peakDb) / 20)
    const freq = bin * binHz
    const midi = 12 * Math.log2(freq / 440) + 69   // exact fractional MIDI

    // Distribute energy across two adjacent semitones instead of hard rounding.
    // This prevents pitch-class aliasing when a note falls between MIDI integers.
    const lo   = Math.floor(midi)
    const frac = midi - lo                           // weight for the higher semitone
    const pcLo = ((lo     % 12) + 12) % 12
    const pcHi = (((lo + 1) % 12) + 12) % 12
    chroma[pcLo] += mag * (1 - frac)
    chroma[pcHi] += mag * frac
  }

  // Max-normalize: detectChords uses cosine similarity which is scale-invariant,
  // but normalization keeps the energy check in the caller meaningful.
  const maxVal = Math.max(...chroma)
  if (maxVal > 0) {
    for (let i = 0; i < 12; i++) chroma[i] /= maxVal
  }

  return chroma
}
