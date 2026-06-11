import { useState } from 'react'
import type { ApiConfig } from '../types/compose'
import type { ChordSlot, MelodyNote, SequencerState } from '../types/audio'

const SYSTEM_PROMPT = `You are a guitar composition assistant. Return ONLY a valid JSON object — no markdown fences, no explanation.

Schema:
{
  "bpm": <integer 40-180>,
  "pattern": "53231323"|"x3231323"|"3_12_3"|"strum",
  "keyRoot": <integer 0-11>,
  "chords": [exactly 8 items: {"root": "C"|"C#"|"D"|"Eb"|"E"|"F"|"F#"|"G"|"Ab"|"A"|"Bb"|"B"|null, "suffix": "major"|"minor"|"7"|"maj7"|"m7"|"sus2"|"sus4"|"dim"|"aug"|"add9"|null, "positionIndex": 0}],
  "melody": [exactly 8 items (one per bar): [8 eighth-note slots: {"semitone": <integer 0-11>}|null]]
}

keyRoot: C=0 C#=1 D=2 Eb=3 E=4 F=5 F#=6 G=7 Ab=8 A=9 Bb=10 B=11
pattern: 53231323=folk fingerpicking, x3231323=muted folk, 3_12_3=classical, strum=strumming
null root/suffix = empty bar (silence). melody null = no melody note on that beat.
For a simple accompaniment leave all melody beats null. Add melody notes for a melodic lead.`

export interface AiComposition {
  bpm: number
  pattern: SequencerState['pattern']
  keyRoot: number
  chords: ChordSlot[]
  melody: (MelodyNote | null)[][]
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
      max_tokens: 1024,
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

function parseComposition(raw: string): AiComposition {
  // Strip any accidental markdown fences
  const json = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
  const obj = JSON.parse(json)

  const bpm     = Math.max(40, Math.min(200, Number(obj.bpm) || 80))
  const pattern = (['53231323','x3231323','3_12_3','strum'] as const).includes(obj.pattern)
    ? obj.pattern as SequencerState['pattern']
    : '53231323'
  const keyRoot = Math.max(0, Math.min(11, Number(obj.keyRoot) || 0))

  const chords: ChordSlot[] = Array.isArray(obj.chords)
    ? obj.chords.slice(0, 8).map((c: { root?: string | null; suffix?: string | null }) => ({
        root: c.root ?? null,
        suffix: c.suffix ?? null,
        positionIndex: 0,
      }))
    : []
  while (chords.length < 8) chords.push({ root: null, suffix: null, positionIndex: 0 })

  // AI returns up to 8 eighth-note slots; map each slot k → master slot k*2
  const melody: (MelodyNote | null)[][] = Array.isArray(obj.melody)
    ? obj.melody.slice(0, 8).map((bar: ({ semitone?: number } | null)[]) => {
        const master: (MelodyNote | null)[] = Array(16).fill(null)
        if (Array.isArray(bar)) {
          bar.slice(0, 8).forEach((n: { semitone?: number } | null, i: number) => {
            if (n && typeof n.semitone === 'number') {
              master[i * 2] = { semitone: Math.max(0, Math.min(11, n.semitone)) }
            }
          })
        }
        return master
      })
    : []
  while (melody.length < 8) melody.push(Array(16).fill(null))

  return { bpm, pattern, keyRoot, chords, melody }
}

export function useAiCompose() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function generate(prompt: string, config: ApiConfig): Promise<AiComposition | null> {
    if (!config.apiKey.trim()) {
      setError('请先配置 API Key')
      return null
    }
    setIsLoading(true)
    setError(null)
    try {
      const raw = config.provider === 'anthropic'
        ? await callAnthropic(prompt, config)
        : await callOpenAi(prompt, config)
      return parseComposition(raw)
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败，请检查网络和配置')
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return { generate, isLoading, error, clearError: () => setError(null) }
}
