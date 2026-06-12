// Fine-grained synthesis parameters — exposed in the advanced settings panel.
// Separate from PickupConfig so the two concerns don't mix.

export interface SynthConfig {
  // Acoustic KS loop
  acousticLoopA:    number   // KS loop filter coefficient (brightness)
  acousticDecay:    number   // per-iteration decay factor

  // Electric global offsets applied on top of TONE_TABLE base values
  elecBrightness:   number   // loopA offset: positive = brighter, negative = darker
  elecDecayOffset:  number   // decay offset: positive = more sustain

  // Effect drive / filtering
  overdriveDrive:   number   // tanh drive amount (0–0.65)
  distortionDrive:  number   // hard-clip drive amount (0.5–1.0)
  overdriveLp:      number   // post-drive lowpass cutoff Hz
  distortionLp:     number   // post-drive lowpass cutoff Hz

  // Note duration per mode (seconds)
  durAcoustic:      number
  durClean:         number   // electric clean
  durOverdrive:     number
  durDistortion:    number

  // KS excitation + envelope
  exciteSmooth:     number   // pre-filter blend ratio for initial noise (0=raw, higher=smoother)
  fadeOutStart:     number   // fraction of buffer where fade-out begins (0–1)
}

export const SYNTH_DEFAULTS: SynthConfig = {
  acousticLoopA:   0.50,
  acousticDecay:   0.998,
  elecBrightness:  0,
  elecDecayOffset: 0,
  overdriveDrive:  0.35,
  distortionDrive: 0.75,
  overdriveLp:     6000,
  distortionLp:    4000,
  durAcoustic:     2.2,
  durClean:        2.0,
  durOverdrive:    1.2,
  durDistortion:   0.7,
  exciteSmooth:    0.45,
  fadeOutStart:    0.75,
}

const LS_KEY = 'guitar-chord-synth'
const _listeners = new Set<() => void>()

let _cfg: SynthConfig = (() => {
  try {
    const s = localStorage.getItem(LS_KEY)
    if (s) return { ...SYNTH_DEFAULTS, ...JSON.parse(s) }
  } catch { /* ignore */ }
  return { ...SYNTH_DEFAULTS }
})()

export function getSynthConfig(): SynthConfig { return _cfg }

export function setSynthConfig(patch: Partial<SynthConfig>): void {
  _cfg = { ..._cfg, ...patch }
  try { localStorage.setItem(LS_KEY, JSON.stringify(_cfg)) } catch { /* ignore */ }
  _listeners.forEach(fn => fn())
}

export function resetSynthConfig(): void {
  _cfg = { ...SYNTH_DEFAULTS }
  try { localStorage.setItem(LS_KEY, JSON.stringify(_cfg)) } catch { /* ignore */ }
  _listeners.forEach(fn => fn())
}

export function subscribeSynth(fn: () => void): () => void {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}
