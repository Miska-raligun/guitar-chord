export const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

export function freqToMidi(freq: number): number {
  return 12 * Math.log2(freq / 440) + 69
}

export function midiToPitchClass(midi: number): number {
  return ((Math.round(midi) % 12) + 12) % 12
}

export function freqToPitchClass(freq: number): number {
  return midiToPitchClass(freqToMidi(freq))
}

export function pitchClassToName(pc: number): string {
  return NOTE_NAMES[((pc % 12) + 12) % 12]
}
