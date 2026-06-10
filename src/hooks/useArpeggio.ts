import { useState, useRef, useCallback, useEffect } from 'react'
import { pluckStringAt, pluckMutedAt, stopAllNodes } from '../audio/karplusStrong'
import audioEngine from '../audio/AudioEngine'
import type { ChordPosition } from '../types/chord'
import { OPEN_STRING_FREQS } from '../types/chord'
import type { ArpeggioPattern, ArpeggioState, CustomConfig, CustomStepKind } from '../types/audio'

// ─── 内部步骤格式 ─────────────────────────────────────────────
// number   : 弦索引 0-5，或下列哨值
// number[] : 同时拨多弦
type PatternStep = number | number[]

const BASS        = -10  // 自动识别根音弦，正常拨
const MUTE_BASS   = -11  // 自动识别根音弦，闷音
const REST        = -20  // 休止
const STRUM_DOWN  = -30  // 下扫弦
const STRUM_UP    = -31  // 上扫弦

// ─── 内置节奏型 ──────────────────────────────────────────────
const PATTERN_53231323: PatternStep[] = [BASS,      3, 4, 3, 5, 3, 4, 3]
const PATTERN_X3231323: PatternStep[] = [MUTE_BASS, 3, 4, 3, 5, 3, 4, 3]
const PATTERN_3_12_3:   PatternStep[] = [BASS, 3, [4, 5], 3]

type StrumBeat = { dir: 'down' | 'up'; vel: number }
const STRUM_BEATS: StrumBeat[] = [
  { dir: 'down', vel: 1.0 },
  { dir: 'down', vel: 0.7 },
  { dir: 'up',   vel: 0.55 },
  { dir: 'up',   vel: 0.5 },
  { dir: 'down', vel: 0.85 },
  { dir: 'up',   vel: 0.5 },
]
const SWEEP_DURATION = 0.055

// ─── 工具 ────────────────────────────────────────────────────
const BASS_VOL   = 0.88
const TREBLE_VOL = 0.55

function getBassString(pos: ChordPosition): number {
  for (let i = 0; i < pos.frets.length; i++) {
    if (pos.frets[i] !== -1) return i
  }
  return 1
}

function getFreq(pos: ChordPosition, strIdx: number): number | null {
  const fret = pos.frets[strIdx]
  if (fret === -1) return null
  return OPEN_STRING_FREQS[strIdx] * Math.pow(2, fret / 12)
}

// 将自定义步骤枚举转换为内部 PatternStep
function customKindToStep(kind: CustomStepKind): PatternStep {
  switch (kind) {
    case '—':  return REST
    case '根': return BASS
    case 'x':  return MUTE_BASS
    case '1':  return 5
    case '2':  return 4
    case '3':  return 3
    case '4':  return 2
    case '5':  return 1
    case '6':  return 0
    case '12': return [5, 4]
    case '↓':  return STRUM_DOWN
    case '↑':  return STRUM_UP
  }
}

// ─────────────────────────────────────────────────────────────

export function useArpeggio() {
  const [arpeggioState, setArpeggioState] = useState<ArpeggioState>({
    isPlaying: false,
    bpm: 80,
    pattern: '53231323',
    activeString: null,
    isStrumBeat: false,
  })

  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextTimeRef    = useRef(0)
  const stepRef        = useRef(0)
  const posRef         = useRef<ChordPosition | null>(null)
  const patternRef     = useRef<ArpeggioPattern>('53231323')
  const bpmRef         = useRef(80)
  const genRef         = useRef(0)
  const customStepsRef = useRef<PatternStep[]>([])
  const customSecRef   = useRef<number>(60 / 80)  // seconds per step

  // ─── 动画工具 ───────────────────────────────────────────────
  const animateString = useCallback((strIdx: number, time: number, gen: number, dur = 170) => {
    const ms = Math.max(0, (time - audioEngine.getContext().currentTime) * 1000)
    setTimeout(() => {
      if (genRef.current !== gen) return
      setArpeggioState(s => ({ ...s, activeString: strIdx, isStrumBeat: false }))
      setTimeout(() => {
        if (genRef.current !== gen) return
        setArpeggioState(s => ({ ...s, activeString: null }))
      }, dur)
    }, ms)
  }, [])

  const animateFlash = useCallback((time: number, gen: number, dur = 200) => {
    const ms = Math.max(0, (time - audioEngine.getContext().currentTime) * 1000)
    setTimeout(() => {
      if (genRef.current !== gen) return
      setArpeggioState(s => ({ ...s, isStrumBeat: true, activeString: null }))
      setTimeout(() => {
        if (genRef.current !== gen) return
        setArpeggioState(s => ({ ...s, isStrumBeat: false }))
      }, dur)
    }, ms)
  }, [])

  // ─── 扫弦（共用）───────────────────────────────────────────
  const doStrum = useCallback((dir: 'down' | 'up', vel: number, time: number, gen: number) => {
    const pos = posRef.current
    if (!pos) return
    const strings = dir === 'down' ? [0,1,2,3,4,5] : [5,4,3,2,1,0]
    const dps = SWEEP_DURATION / 5
    strings.forEach((si, i) => {
      const freq = getFreq(pos, si)
      if (freq === null) return
      const v = dir === 'down' ? vel * (0.6 + i * 0.01) : vel * (0.55 - i * 0.01)
      pluckStringAt(freq, time + i * dps, v)
    })
    animateFlash(time, gen, Math.min((60 / bpmRef.current) * 700, 280))
  }, [animateFlash])

  // ─── 调度单步 ────────────────────────────────────────────────
  const scheduleStep = useCallback((rawStep: PatternStep, time: number, isBass: boolean, gen: number) => {
    const pos = posRef.current
    if (!pos) return

    if (rawStep === REST) return

    if (rawStep === STRUM_DOWN) { doStrum('down', 0.78, time, gen); return }
    if (rawStep === STRUM_UP)   { doStrum('up',   0.48, time, gen); return }

    if (rawStep === BASS || rawStep === MUTE_BASS) {
      const si  = getBassString(pos)
      const freq = getFreq(pos, si)
      if (freq === null) return
      if (rawStep === BASS) {
        pluckStringAt(freq, time, BASS_VOL)
        animateString(si, time, gen, 190)
      } else {
        pluckMutedAt(freq, time, 0.72)
        animateString(si, time, gen, 190)
        animateFlash(time, gen, 160)
      }
      return
    }

    if (Array.isArray(rawStep)) {
      const playable = rawStep.filter(i => pos.frets[i] !== -1)
      if (playable.length === 0) return
      playable.forEach(si => {
        const freq = getFreq(pos, si)
        if (freq !== null) pluckStringAt(freq, time, TREBLE_VOL * 1.1)
      })
      animateString(playable[playable.length - 1], time, gen, 200)
      return
    }

    // 普通单弦
    const freq = getFreq(pos, rawStep)
    if (freq === null) return
    pluckStringAt(freq, time, isBass ? BASS_VOL : TREBLE_VOL)
    animateString(rawStep, time, gen)
  }, [animateString, animateFlash, doStrum])

  // ─── 调度器主循环 ─────────────────────────────────────────────
  const schedulerTick = useCallback(() => {
    const ctx = audioEngine.getContext()
    const gen = genRef.current
    const pat = patternRef.current
    const bpm = bpmRef.current
    const lookahead = 0.1

    if (pat === 'strum') {
      const sPerBeat = 60 / bpm
      while (nextTimeRef.current < ctx.currentTime + lookahead) {
        doStrum(
          STRUM_BEATS[stepRef.current % STRUM_BEATS.length].dir,
          STRUM_BEATS[stepRef.current % STRUM_BEATS.length].vel,
          nextTimeRef.current, gen
        )
        nextTimeRef.current += sPerBeat
        stepRef.current++
      }
      return
    }

    let steps: PatternStep[]
    let sPerStep: number
    if (pat === 'custom') {
      steps    = customStepsRef.current
      sPerStep = customSecRef.current
    } else if (pat === '53231323') {
      steps = PATTERN_53231323; sPerStep = 60 / bpm / 2
    } else if (pat === 'x3231323') {
      steps = PATTERN_X3231323; sPerStep = 60 / bpm / 2
    } else {
      steps = PATTERN_3_12_3; sPerStep = 60 / bpm
    }

    if (steps.length === 0) return

    while (nextTimeRef.current < ctx.currentTime + lookahead) {
      const step = stepRef.current % steps.length
      scheduleStep(steps[step], nextTimeRef.current, step === 0, gen)
      nextTimeRef.current += sPerStep
      stepRef.current++
    }
  }, [scheduleStep, doStrum])

  // ─── 公开 API ────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (intervalRef.current !== null) { clearInterval(intervalRef.current); intervalRef.current = null }
    genRef.current++
    stopAllNodes()
    setArpeggioState(s => ({ ...s, isPlaying: false, activeString: null, isStrumBeat: false }))
  }, [])

  const play = useCallback((
    position: ChordPosition,
    pattern: ArpeggioPattern,
    bpm: number,
    customConfig?: CustomConfig
  ) => {
    if (intervalRef.current !== null) { clearInterval(intervalRef.current); intervalRef.current = null }
    genRef.current++
    stopAllNodes()

    if (pattern === 'custom' && customConfig) {
      customStepsRef.current = customConfig.steps.map(customKindToStep)
      customSecRef.current   = customConfig.duration === 'quarter' ? 60 / bpm : 60 / bpm / 2
    }

    posRef.current    = position
    patternRef.current = pattern
    bpmRef.current    = bpm
    stepRef.current   = 0

    audioEngine.resume()
    nextTimeRef.current = audioEngine.getContext().currentTime + 0.05
    setArpeggioState({ isPlaying: true, bpm, pattern, activeString: null, isStrumBeat: false })
    intervalRef.current = setInterval(schedulerTick, 25)
  }, [schedulerTick])

  // 播放中实时更新自定义节奏型（不重启）
  const updateCustomPattern = useCallback((config: CustomConfig, bpm: number) => {
    customStepsRef.current = config.steps.map(customKindToStep)
    customSecRef.current   = config.duration === 'quarter' ? 60 / bpm : 60 / bpm / 2
  }, [])

  useEffect(() => () => stop(), [stop])

  return { arpeggioState, play, stop, updateCustomPattern }
}
