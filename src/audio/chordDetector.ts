import { CHORD_TEMPLATES } from '../data/chordTemplates'
import { NOTE_NAMES } from '../utils/noteUtils'
import type { ChordMatch } from '../types/audio'

export function detectChords(chromagram: Float32Array, topN = 3): ChordMatch[] {
  const results: Array<{ root: number; suffix: string; score: number }> = []

  for (const tmpl of CHORD_TEMPLATES) {
    let dot = 0
    let magChroma = 0
    let magTmpl = 0
    for (let i = 0; i < 12; i++) {
      const c = chromagram[i]
      const t = tmpl.template[i]
      dot += c * t
      magChroma += c * c
      magTmpl += t * t
    }
    const denom = Math.sqrt(magChroma) * Math.sqrt(magTmpl) + 1e-8
    const score = dot / denom
    results.push({ root: tmpl.root, suffix: tmpl.suffix, score })
  }

  results.sort((a, b) => b.score - a.score)

  return results.slice(0, topN).map(r => ({
    root: NOTE_NAMES[r.root],
    suffix: r.suffix,
    confidence: r.score,
    positions: [],
  }))
}
