import { useState } from 'react'
import type { ApiConfig } from '../types/compose'
import type { ChordSlot, MelodyNote, SequencerState, TimeSig } from '../types/audio'
import type { GuitarMode, EffectType } from '../audio/toneConfig'
import { getMasterSlotsPerBar } from './useSequencer'

const ROOT_NAMES_AI = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B']

export interface ContinueFromState {
  chords: ChordSlot[]
  bpm: number
  timeSig: TimeSig
  pattern: SequencerState['pattern']
  keyRoot: number
}

function buildContinuationPrefix(ctx: ContinueFromState, targetBars: number | undefined): string {
  const chordNames = ctx.chords
    .map(c => {
      if (!c.root) return '─'
      const name = c.root + (c.suffix && c.suffix !== 'major' ? c.suffix : '')
      return c.noteValue && c.noteValue > 1 ? `${name}(nv${c.noteValue})` : name
    })
    .join(' ')
  const bars = targetBars ?? 8
  const key = ROOT_NAMES_AI[ctx.keyRoot]
  const patternName = { '53231323': 'folk', 'x3231323': 'muted folk', '3_12_3': 'classical', 'strum': 'strum' }[ctx.pattern] ?? ctx.pattern
  return `[CONTINUATION MODE — append ~${bars} physical bars to the composition below. ` +
    `Return ONLY the new chord events. Key: ${key}, BPM: ${ctx.bpm}, timeSig: ${ctx.timeSig}, pattern: ${ctx.pattern} (${patternName}). ` +
    `Existing chord events (${ctx.chords.length}): ${chordNames || 'empty'}. ` +
    `Continue with consistent style and pattern. User request follows:] `
}

const VALID_TIMSIGS = ['4/4', '3/4', '6/8', '2/4'] as const

const SYSTEM_PROMPT = `You are a guitar composition assistant. Return ONLY a valid JSON object — no markdown fences, no explanation.

Schema:
{
  "bpm": <integer 40-180>,
  "timeSig": "4/4"|"3/4"|"6/8"|"2/4",
  "pattern": "53231323"|"x3231323"|"3_12_3"|"strum",
  "keyRoot": <integer 0-11, C=0 C#=1 D=2 Eb=3 E=4 F=5 F#=6 G=7 Ab=8 A=9 Bb=10 B=11>,
  "bars": <integer — total physical bars in the piece>,
  "tone": {"mode": "acoustic"|"electric", "effect": "clean"|"overdrive"|"distortion"},
  "chords": [one object per chord event:
    {
      "root": "C"|"C#"|"D"|"Eb"|"E"|"F"|"F#"|"G"|"Ab"|"A"|"Bb"|"B"|null,
      "suffix": "major"|"minor"|"7"|"maj7"|"m7"|"sus2"|"sus4"|"dim"|"aug"|"add9"|null,
      "positionIndex": 0,
      "noteValue": 1|2|4|8  (STRUM MODE ONLY — how long this chord lasts: 1=full bar, 2=half bar, 4=quarter note, 8=eighth note)
    }
  ],
  "melody": [one array per chord event (same length as chords):
    a sequential stream of note/rest events that play back-to-back and fill the chord event's duration.
    each element:
      {"semitone": <integer 0-11>, "dur": 16|8|4|2|1}   for a note
      {"dur": 16|8|4|2|1}  (no semitone)  or  null      for a rest
    dur = note-value DENOMINATOR (same idea as chord noteValue):
      16=sixteenth, 8=eighth, 4=quarter, 2=half, 1=whole(one full bar)
    The durations should sum to one full event: a 4/4 bar = 16 sixteenths = 8 eighths = 4 quarters, etc.
  ]
}

RULES:
- chords.length MUST equal melody.length (one melody array per chord event)
- null root = silence/rest for that event

PATTERN SELECTION — pick based on style:
- "53231323": folk fingerpicking — gentle acoustic ballads, singer-songwriter. Each chord = 1 full bar of arpeggios.
- "x3231323": muted folk fingerpicking — mid-tempo, rhythmic acoustic with chop.
- "3_12_3": classical fingerpicking — solo guitar, arpeggiated pieces, Spanish guitar feel.
- "strum": STRUMMED chords — pop, rock, country, R&B, energetic or upbeat songs. DO NOT default to fingerpicking for these styles.
  With strum, use noteValue to create rhythm (fingerpicking patterns ignore noteValue — each chord is always 1 bar):
  • noteValue=1: single strum lasting the whole bar (sparse, powerful)
  • noteValue=2: half-bar strums (slow rock, 2 strums/bar)
  • noteValue=4: quarter-note strums (standard pop/rock, 4 strums/bar — very common)
  • noteValue=8: eighth-note strums (fast, driving rhythm)
  Mix noteValues within bars for syncopation: e.g. [nv=2, nv=4, nv=4] fills one bar with half+quarter+quarter
  Example: 4 bars of pop-rock with quarter strums = 16 chord events, all noteValue=4
  Example: slow ballad strum = 4 chord events, all noteValue=1 (one strum per bar)

MELODY dur — note-value denominator, controls how LONG each melody note lasts (NOT pitch):
- dur=16 (sixteenth): fast, busy runs — USE THIS whenever the user asks for 十六分音符 / sixteenth notes
- dur=8 (eighth): common flowing melody (a good default)
- dur=4 (quarter): steady, deliberate notes
- dur=2 (half): sustained note over half a bar
- dur=1 (whole): one long held note for the whole bar
- A calm/slow mood can STILL use sixteenth notes — tempo (BPM) controls speed, dur controls note length. Honor explicit duration requests exactly: if the user demands sixteenth notes, every melody note must be dur=16.
- Use null (or {"dur":n} with no semitone) for rests. Leave melody all-rests for pure chord accompaniment.

BARS: if user specifies a bar count, aim for that many physical bars. In strum mode, chords.length = sum of events (may exceed bars when using noteValue<1).
TONE: acoustic=folk/classical, electric+clean=jazz/pop/soul, electric+overdrive=rock/blues, electric+distortion=metal/punk
TIMSIG: 4/4=default for most styles, 3/4 or 6/8=waltz/triple feel, 2/4=march`

export interface AiTone {
  mode: GuitarMode
  effect: EffectType
}

export interface AiComposition {
  bpm: number
  timeSig: TimeSig
  pattern: SequencerState['pattern']
  keyRoot: number
  chords: ChordSlot[]
  melody: (MelodyNote | null)[][]
  tone?: AiTone
}

async function callOpenAi(prompt: string, config: ApiConfig): Promise<string> {
  const url = `${config.baseUrl.replace(/\/$/, '')}/v1/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: prompt },
      ],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API 错误 ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.choices[0].message.content as string
}

async function callAnthropic(prompt: string, config: ApiConfig): Promise<string> {
  const url = `${config.baseUrl.replace(/\/$/, '')}/v1/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API 错误 ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.content[0].text as string
}

function parseComposition(raw: string, targetBars?: number): AiComposition {
  const json = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
  const obj = JSON.parse(json)

  const bpm     = Math.max(40, Math.min(200, Number(obj.bpm) || 80))
  const timeSig: TimeSig = VALID_TIMSIGS.includes(obj.timeSig) ? obj.timeSig as TimeSig : '4/4'
  const pattern = (['53231323','x3231323','3_12_3','strum'] as const).includes(obj.pattern)
    ? obj.pattern as SequencerState['pattern']
    : '53231323'
  const keyRoot = Math.max(0, Math.min(11, Number(obj.keyRoot) || 0))
  const isStrum = pattern === 'strum'

  // Parse chords with optional noteValue (strum mode only)
  const VALID_NV = [1, 2, 4, 8, 16] as const
  const rawChords: ChordSlot[] = Array.isArray(obj.chords)
    ? obj.chords.map((c: { root?: string | null; suffix?: string | null; noteValue?: number }) => {
        const nv = VALID_NV.includes(c.noteValue as 1|2|4|8|16)
          ? c.noteValue as (1|2|4|8|16)
          : undefined
        return {
          root: c.root ?? null,
          suffix: c.suffix ?? null,
          positionIndex: 0,
          ...(isStrum && nv && nv > 1 ? { noteValue: nv } : {}),
        }
      })
    : []

  // Chord count: in strum mode trust AI's event count; in fingerpicking enforce targetBars
  let numChords: number
  if (isStrum) {
    numChords = Math.max(1, Math.min(128, rawChords.length || targetBars || 8))
  } else {
    const fallback = rawChords.length || 8
    numChords = Math.max(1, Math.min(32, targetBars ?? Number(obj.bars) ?? fallback))
  }

  const chords = rawChords.slice(0, numChords)
  while (chords.length < numChords) chords.push({ root: null, suffix: null, positionIndex: 0 })

  // Melody: one array per chord event, sequential note/rest placement.
  // dur is a note-value denominator (16=sixteenth … 1=whole); convert to master slots.
  const masterPerBar = getMasterSlotsPerBar(timeSig)  // 16 for 4/4
  const VALID_DUR = [1, 2, 4, 8, 16]
  const durToMaster = (d: number | undefined) => {
    const denom = VALID_DUR.includes(d as number) ? (d as number) : 8 // default eighth note
    return Math.max(1, Math.round(masterPerBar / denom))
  }

  const melody: (MelodyNote | null)[][] = Array.isArray(obj.melody)
    ? obj.melody.slice(0, numChords).map((barArr: unknown, chordIdx: number) => {
        const master: (MelodyNote | null)[] = Array(masterPerBar).fill(null)
        const noteValue = chords[chordIdx]?.noteValue ?? 1
        const maxMasterSlots = isStrum
          ? Math.round(masterPerBar / noteValue)
          : masterPerBar
        if (Array.isArray(barArr)) {
          let masterPos = 0
          for (const n of barArr as ({ semitone?: number; dur?: number } | null)[]) {
            if (masterPos >= maxMasterSlots) break
            const span = Math.min(durToMaster(n?.dur), maxMasterSlots - masterPos)
            if (n && typeof n.semitone === 'number') {
              master[masterPos] = {
                semitone: Math.max(0, Math.min(11, n.semitone)),
                duration: span,
              }
            }
            masterPos += span
          }
        }
        return master
      })
    : []
  while (melody.length < numChords) melody.push(Array(masterPerBar).fill(null))

  // Optional tone suggestion
  let tone: AiTone | undefined
  if (obj.tone && typeof obj.tone === 'object') {
    const mode = obj.tone.mode === 'electric' ? 'electric' : 'acoustic'
    const effect = (['clean','overdrive','distortion'] as const).includes(obj.tone.effect)
      ? obj.tone.effect as EffectType
      : 'clean'
    tone = { mode, effect }
  }

  return { bpm, timeSig, pattern, keyRoot, chords, melody, tone }
}

export function useAiCompose() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function generate(prompt: string, config: ApiConfig, targetBars?: number, continueFrom?: ContinueFromState): Promise<AiComposition | null> {
    if (!config.apiKey.trim()) {
      setError('请先配置 API Key')
      return null
    }
    setIsLoading(true)
    setError(null)
    const bars = targetBars ?? (continueFrom ? 8 : undefined)
    const barPrefix = bars ? `[目标：约 ${bars} 个物理小节。在 strum 模式下，若使用 noteValue=4，则 chords 约需 ${bars * 4} 项] ` : ''
    const contPrefix = continueFrom ? buildContinuationPrefix(continueFrom, bars) : ''
    const userMsg = contPrefix + barPrefix + prompt
    try {
      const raw = config.provider === 'anthropic'
        ? await callAnthropic(userMsg, config)
        : await callOpenAi(userMsg, config)
      return parseComposition(raw, bars)
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败，请检查网络和配置')
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return { generate, isLoading, error, clearError: () => setError(null) }
}
