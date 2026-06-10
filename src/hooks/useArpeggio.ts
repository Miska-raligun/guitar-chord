import { useState, useRef, useCallback, useEffect } from 'react'
import { pluckStringAt, pluckMutedAt, stopAllNodes } from '../audio/karplusStrong'
import audioEngine from '../audio/AudioEngine'
import type { ChordPosition } from '../types/chord'
import { OPEN_STRING_FREQS } from '../types/chord'
import type { ArpeggioPattern, ArpeggioState } from '../types/audio'

// ─── 步骤类型 ────────────────────────────────────────────────
// number   : 弦索引 0-5（0=低音E, 5=高音E）或哨值
// number[] : 同时拨多弦（如 [4,5] = B弦+高音E弦同时）
type PatternStep = number | number[]

// 哨值
const BASS      = -10  // 自动识别当前和弦最低非静音弦，正常拨
const MUTE_BASS = -11  // 同上，但用闷音（切音效果）

// ─── 节奏型定义 ──────────────────────────────────────────────
// 弦编号对照: 吉他1弦=高音E=idx5, 2弦=B=idx4, 3弦=G=idx3, 4弦=D=idx2, 5弦=A=idx1, 6弦=低音E=idx0

// 根音+3231323：根音弦自动识别（G和弦→6弦，C/Am→5弦，D→4弦…）
const PATTERN_53231323: PatternStep[] = [BASS,      3, 4, 3, 5, 3, 4, 3]

// x3231323：闷根音 + 同样的高音弦型
const PATTERN_X3231323: PatternStep[] = [MUTE_BASS, 3, 4, 3, 5, 3, 4, 3]

// 根音·3·(12)·3：每步一个四分音符，(12) = 1弦+2弦同时拨
const PATTERN_3_12_3: PatternStep[] = [BASS, 3, [4, 5], 3]

// ─── 扫弦 ────────────────────────────────────────────────────
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

// ─── 音量 ────────────────────────────────────────────────────
const BASS_VOL   = 0.88
const TREBLE_VOL = 0.55

// ─── 工具 ────────────────────────────────────────────────────
function getBassString(position: ChordPosition): number {
  for (let i = 0; i < position.frets.length; i++) {
    if (position.frets[i] !== -1) return i
  }
  return 1  // fallback A弦
}

function getStringFreq(position: ChordPosition, strIdx: number): number | null {
  const fret = position.frets[strIdx]
  if (fret === -1) return null
  return OPEN_STRING_FREQS[strIdx] * Math.pow(2, fret / 12)
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

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextTimeRef = useRef(0)
  const stepRef     = useRef(0)
  const posRef      = useRef<ChordPosition | null>(null)
  const patternRef  = useRef<ArpeggioPattern>('53231323')
  const bpmRef      = useRef(80)
  const genRef      = useRef(0)

  // 触发单步UI高亮（传入已解析的实际弦索引）
  const animateString = useCallback((strIdx: number, time: number, gen: number, duration = 170) => {
    const delayMs = Math.max(0, (time - audioEngine.getContext().currentTime) * 1000)
    setTimeout(() => {
      if (genRef.current !== gen) return
      setArpeggioState(s => ({ ...s, activeString: strIdx, isStrumBeat: false }))
      setTimeout(() => {
        if (genRef.current !== gen) return
        setArpeggioState(s => ({ ...s, activeString: null }))
      }, duration)
    }, delayMs)
  }, [])

  // 触发切音/扫弦闪光
  const animateFlash = useCallback((time: number, gen: number, duration = 200) => {
    const delayMs = Math.max(0, (time - audioEngine.getContext().currentTime) * 1000)
    setTimeout(() => {
      if (genRef.current !== gen) return
      setArpeggioState(s => ({ ...s, isStrumBeat: true, activeString: null }))
      setTimeout(() => {
        if (genRef.current !== gen) return
        setArpeggioState(s => ({ ...s, isStrumBeat: false }))
      }, duration)
    }, delayMs)
  }, [])

  // ─── 调度单步（支持 BASS / MUTE_BASS / 多弦数组 / 普通单弦）───
  const scheduleStep = useCallback((rawStep: PatternStep, time: number, isBassStep: boolean, gen: number) => {
    const pos = posRef.current
    if (!pos) return

    // ① BASS / MUTE_BASS：自动定位根音弦
    if (rawStep === BASS || rawStep === MUTE_BASS) {
      const bassIdx = getBassString(pos)
      const freq = getStringFreq(pos, bassIdx)
      if (freq === null) return
      if (rawStep === BASS) {
        pluckStringAt(freq, time, BASS_VOL)
      } else {
        pluckMutedAt(freq, time, 0.72)  // 切音音色
      }
      animateString(bassIdx, time, gen, 190)
      if (rawStep === MUTE_BASS) animateFlash(time, gen, 160)
      return
    }

    // ② 多弦同时（如 [4,5]）
    if (Array.isArray(rawStep)) {
      const playable = rawStep.filter(i => pos.frets[i] !== -1)
      if (playable.length === 0) return
      playable.forEach(strIdx => {
        const freq = getStringFreq(pos, strIdx)
        if (freq !== null) pluckStringAt(freq, time, TREBLE_VOL * 1.1)
      })
      // 高亮最高音弦（视觉上最显眼）
      animateString(playable[playable.length - 1], time, gen, 200)
      return
    }

    // ③ 普通单弦
    const freq = getStringFreq(pos, rawStep)
    if (freq === null) return
    pluckStringAt(freq, time, isBassStep ? BASS_VOL : TREBLE_VOL)
    animateString(rawStep, time, gen)
  }, [animateString, animateFlash])

  // ─── 扫弦 ────────────────────────────────────────────────────
  const scheduleStrum = useCallback((beat: StrumBeat, beatTime: number, gen: number) => {
    const pos = posRef.current
    if (!pos) return

    const strings = beat.dir === 'down' ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0]
    const delayPerStr = SWEEP_DURATION / 5

    strings.forEach((strIdx, i) => {
      const freq = getStringFreq(pos, strIdx)
      if (freq === null) return
      const vol = beat.dir === 'down'
        ? beat.vel * (0.6 + i * 0.01)
        : beat.vel * (0.55 - i * 0.01)
      pluckStringAt(freq, beatTime + i * delayPerStr, vol)
    })

    const flashDuration = Math.min((60 / bpmRef.current) * 700, 280)
    animateFlash(beatTime, gen, flashDuration)
  }, [animateFlash])

  // ─── 调度器主循环 ─────────────────────────────────────────────
  const schedulerTick = useCallback(() => {
    const ctx  = audioEngine.getContext()
    const gen  = genRef.current
    const pat  = patternRef.current
    const bpm  = bpmRef.current
    const lookahead = 0.1

    if (pat === 'strum') {
      const secPerBeat = 60 / bpm
      while (nextTimeRef.current < ctx.currentTime + lookahead) {
        scheduleStrum(STRUM_BEATS[stepRef.current % STRUM_BEATS.length], nextTimeRef.current, gen)
        nextTimeRef.current += secPerBeat
        stepRef.current++
      }
      return
    }

    // 指法模式
    let patternSteps: PatternStep[]
    let secPerStep: number
    if (pat === '53231323') {
      patternSteps = PATTERN_53231323
      secPerStep   = 60 / bpm / 2  // 8分音符
    } else if (pat === 'x3231323') {
      patternSteps = PATTERN_X3231323
      secPerStep   = 60 / bpm / 2
    } else {
      // '3_12_3': 四分音符
      patternSteps = PATTERN_3_12_3
      secPerStep   = 60 / bpm
    }

    while (nextTimeRef.current < ctx.currentTime + lookahead) {
      const step    = stepRef.current % patternSteps.length
      const isBass  = step === 0
      scheduleStep(patternSteps[step], nextTimeRef.current, isBass, gen)
      nextTimeRef.current += secPerStep
      stepRef.current++
    }
  }, [scheduleStep, scheduleStrum])

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    genRef.current++
    stopAllNodes()
    setArpeggioState(s => ({ ...s, isPlaying: false, activeString: null, isStrumBeat: false }))
  }, [])

  const play = useCallback((position: ChordPosition, pattern: ArpeggioPattern, bpm: number) => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    genRef.current++
    stopAllNodes()

    posRef.current    = position
    patternRef.current = pattern
    bpmRef.current    = bpm
    stepRef.current   = 0

    audioEngine.resume()
    nextTimeRef.current = audioEngine.getContext().currentTime + 0.05
    setArpeggioState({ isPlaying: true, bpm, pattern, activeString: null, isStrumBeat: false })
    intervalRef.current = setInterval(schedulerTick, 25)
  }, [schedulerTick])

  useEffect(() => () => stop(), [stop])

  return { arpeggioState, play, stop }
}
