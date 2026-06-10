import type { ChordPosition } from '../../types/chord'
import type { ArpeggioPattern, ArpeggioState } from '../../types/audio'

interface Props {
  position: ChordPosition
  arpeggioState: ArpeggioState
  onPlay: (position: ChordPosition, pattern: ArpeggioPattern, bpm: number) => void
  onStop: () => void
  onPatternChange: (pattern: ArpeggioPattern) => void
  onBpmChange: (bpm: number) => void
}

const PATTERN_LABELS: Record<ArpeggioPattern, string> = {
  folk: '民谣 (p-i-m-a)',
  classical: '古典 (p-a-m-i)',
  pop: '扫弦',
}

export default function ArpeggioPlayer({
  position,
  arpeggioState,
  onPlay,
  onStop,
  onPatternChange,
  onBpmChange,
}: Props) {
  const { isPlaying, bpm, pattern } = arpeggioState

  return (
    <div className="w-full space-y-3">
      <div className="text-xs text-zinc-500 uppercase tracking-wider">分解和弦</div>

      <div className="flex gap-2 flex-wrap">
        {(Object.keys(PATTERN_LABELS) as ArpeggioPattern[]).map(p => (
          <button
            key={p}
            onClick={() => onPatternChange(p)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              pattern === p
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {PATTERN_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-400 w-12">速度</span>
        <input
          type="range"
          min={40}
          max={200}
          step={5}
          value={bpm}
          onChange={e => onBpmChange(Number(e.target.value))}
          className="flex-1 accent-amber-500"
        />
        <span className="text-xs text-zinc-400 w-14">{bpm} BPM</span>
      </div>

      <button
        onClick={() =>
          isPlaying ? onStop() : onPlay(position, pattern, bpm)
        }
        className={`w-full py-3 rounded-xl font-medium transition-colors ${
          isPlaying
            ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
            : 'bg-amber-500 text-zinc-950 hover:bg-amber-400'
        }`}
      >
        {isPlaying ? '⏹ 停止播放' : '▶ 播放分解和弦'}
      </button>
    </div>
  )
}
