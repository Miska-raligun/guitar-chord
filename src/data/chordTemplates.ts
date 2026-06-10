// Pre-computed chord templates for chromagram matching.
// Each template is a 12-element array with 1.0 at active pitch classes.
// Indexed: 0=C, 1=C#, 2=D, 3=Eb, 4=E, 5=F, 6=F#, 7=G, 8=Ab, 9=A, 10=Bb, 11=B

export interface ChordTemplate {
  root: number
  suffix: string
  template: Float32Array
}

const SUFFIX_INTERVALS: Record<string, number[]> = {
  major:   [0, 4, 7],
  minor:   [0, 3, 7],
  '7':     [0, 4, 7, 10],
  maj7:    [0, 4, 7, 11],
  m7:      [0, 3, 7, 10],
  sus2:    [0, 2, 7],
  sus4:    [0, 5, 7],
  dim:     [0, 3, 6],
  aug:     [0, 4, 8],
  'm7b5':  [0, 3, 6, 10],
  dim7:    [0, 3, 6, 9],
  add9:    [0, 2, 4, 7],
  '6':     [0, 4, 7, 9],
  m6:      [0, 3, 7, 9],
  '9':     [0, 2, 4, 7, 10],
  maj9:    [0, 2, 4, 7, 11],
  m9:      [0, 2, 3, 7, 10],
  '11':    [0, 4, 5, 7, 10],
  maj11:   [0, 4, 5, 7, 11],
  m11:     [0, 3, 5, 7, 10],
  '13':    [0, 4, 7, 9, 10],
  maj13:   [0, 4, 7, 9, 11],
  m13:     [0, 3, 7, 9, 10],
  '7sus4': [0, 5, 7, 10],
  '7sus2': [0, 2, 7, 10],
  '5':     [0, 7],
}

export const CHORD_TEMPLATES: ChordTemplate[] = Object.entries(SUFFIX_INTERVALS).flatMap(
  ([suffix, intervals]) =>
    Array.from({ length: 12 }, (_, root) => {
      const template = new Float32Array(12)
      intervals.forEach(i => {
        template[(root + i) % 12] = 1.0
      })
      return { root, suffix, template }
    })
)
