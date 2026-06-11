import type { ChordSlot, MelodyNote, TimeSig } from './audio'

export interface ApiConfig {
  provider: 'openai' | 'anthropic'
  apiKey: string
  baseUrl: string   // for openai: 'https://api.openai.com'; override for proxies
  model: string
}

export interface SavedComposition {
  id: string
  name: string
  savedAt: number
  bpm: number
  pattern: '53231323' | 'x3231323' | '3_12_3' | 'strum'
  keyRoot: number
  timeSig?: TimeSig
  melodyRes?: 4 | 8 | 16
  chords: ChordSlot[]
  melody: (MelodyNote | null)[][]
}

export const DEFAULT_OPENAI_CONFIG: ApiConfig = {
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com',
  model: 'gpt-4o-mini',
}

export const DEFAULT_ANTHROPIC_CONFIG: ApiConfig = {
  provider: 'anthropic',
  apiKey: '',
  baseUrl: 'https://api.anthropic.com',
  model: 'claude-haiku-4-5-20251001',
}

export const API_CONFIG_KEY        = 'guitar-chord-api-config'
export const COMPOSITIONS_LIST_KEY = 'guitar-chord-compositions'
