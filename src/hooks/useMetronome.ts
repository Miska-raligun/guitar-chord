import { useState, useRef, useCallback, useEffect } from 'react'
import audioEngine from '../audio/AudioEngine'

function scheduleClick(ctx: AudioContext, time: number, accent: boolean) {
  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'triangle'
  osc.frequency.value = accent ? 1200 : 900
  gain.gain.setValueAtTime(accent ? 0.45 : 0.28, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06)
  osc.start(time)
  osc.stop(time + 0.08)
}

export function useMetronome() {
  const [isRunning,    setIsRunning]    = useState(false)
  const [currentBeat,  setCurrentBeat]  = useState(-1)   // 0-based, -1 = idle
  const [beatsPerBar,  setBeatsPerBar]  = useState(4)

  const bpmRef          = useRef(80)
  const beatsPerBarRef  = useRef(4)
  const nextTickRef     = useRef(0)
  const beatCountRef    = useRef(0)
  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const genRef          = useRef(0)

  const tick = useCallback(() => {
    const ctx = audioEngine.getContext()
    const gen = genRef.current
    while (nextTickRef.current < ctx.currentTime + 0.1) {
      const beat   = beatCountRef.current % beatsPerBarRef.current
      const accent = beat === 0
      scheduleClick(ctx, nextTickRef.current, accent)
      const ms = Math.max(0, (nextTickRef.current - ctx.currentTime) * 1000)
      setTimeout(() => {
        if (genRef.current !== gen) return
        setCurrentBeat(beat)
      }, ms)
      nextTickRef.current += 60 / bpmRef.current
      beatCountRef.current++
    }
  }, [])

  const start = useCallback((bpm: number, bpb: number) => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    genRef.current++
    bpmRef.current         = bpm
    beatsPerBarRef.current = bpb
    beatCountRef.current   = 0
    audioEngine.resume()
    nextTickRef.current = audioEngine.getContext().currentTime + 0.05
    setBeatsPerBar(bpb)
    setIsRunning(true)
    setCurrentBeat(-1)
    intervalRef.current = setInterval(tick, 25)
  }, [tick])

  const stop = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    genRef.current++
    setIsRunning(false)
    setCurrentBeat(-1)
  }, [])

  const toggle = useCallback((bpm: number, bpb: number) => {
    if (intervalRef.current) { stop() } else { start(bpm, bpb) }
  }, [start, stop])

  // keep bpm/bpb in sync without restarting
  const syncBpm = useCallback((bpm: number) => { bpmRef.current = bpm }, [])
  const syncBpb = useCallback((bpb: number) => {
    beatsPerBarRef.current = bpb
    setBeatsPerBar(bpb)
  }, [])

  useEffect(() => () => stop(), [stop])

  return { isRunning, currentBeat, beatsPerBar, toggle, stop, syncBpm, syncBpb }
}
