import type { SequencerState } from '../types/audio'

type SharePayload = Pick<
  SequencerState,
  'bpm' | 'pattern' | 'keyRoot' | 'timeSig' | 'noteDuration' | 'chords' | 'melody'
>

function toBase64url(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach(b => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function fromBase64url(b64: string): string {
  const pad = b64.length % 4
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad ? 4 - pad : 0)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export function encodeShareUrl(state: SharePayload): string {
  const payload = {
    bpm:         state.bpm,
    pattern:     state.pattern,
    keyRoot:     state.keyRoot,
    timeSig:     state.timeSig,
    noteDuration: state.noteDuration,
    chords:      state.chords,
    melody:      state.melody,
  }
  const encoded = toBase64url(JSON.stringify(payload))
  const url = new URL(window.location.href)
  url.search = `?s=${encoded}`
  return url.toString()
}

export function decodeShareUrl(encoded: string): SharePayload | null {
  try {
    const obj = JSON.parse(fromBase64url(encoded))
    return {
      bpm:          obj.bpm          ?? 80,
      pattern:      obj.pattern      ?? '53231323',
      keyRoot:      obj.keyRoot      ?? 0,
      timeSig:      obj.timeSig      ?? '4/4',
      noteDuration: obj.noteDuration ?? 2,
      chords:       obj.chords       ?? [],
      melody:       obj.melody       ?? [],
    }
  } catch {
    return null
  }
}
