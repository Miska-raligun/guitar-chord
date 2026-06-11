import { IconPlay, IconStop } from '../ui/icons'
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

const PATTERNS: { id: ArpeggioPattern; title: string; sub: string }[] = [
  { id: '53231323', title: '根·3231323', sub: '民谣指法' },
  { id: 'x3231323', title: 'x·3231323',  sub: '切音指法' },
  { id: '3_12_3',   title: '根·3·12·3', sub: '抒情指法' },
  { id: 'strum',    title: 'DDUUDU',     sub: '扫弦' },
  { id: 'custom',   title: '自定义',     sub: '节奏型' },
]

export default function ArpeggioPlayer({
  position, arpeggioState, onPlay, onStop, onPatternChange, onBpmChange,
}: Props) {
  const { isPlaying, bpm, pattern } = arpeggioState

  return (
    <div className="w-full space-y-3">
      <div className="text-xs text-stone-400 uppercase tracking-wider">伴奏节奏型</div>

      <div className="grid grid-cols-2 gap-2">
        {PATTERNS.slice(0, 4).map(({ id, title, sub }) => (
          <button
            key={id}
            onClick={() => onPatternChange(id)}
            className={`flex flex-col items-center py-2.5 px-2 rounded-xl text-xs font-medium transition-colors leading-tight ${
              pattern === id
                ? 'bg-amber-500 text-stone-50'
                : 'bg-amber-100 text-stone-600 hover:bg-amber-200 hover:text-stone-800'
            }`}
          >
            <span className="font-mono font-bold text-[11px]">{title}</span>
            <span className={`mt-0.5 text-[10px] ${pattern === id ? 'text-amber-100' : 'text-stone-400'}`}>{sub}</span>
          </button>
        ))}
      </div>

      <button
        onClick={() => onPatternChange('custom')}
        className={`w-full py-2.5 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2 ${
          pattern === 'custom'
            ? 'bg-amber-500 text-stone-50'
            : 'bg-amber-100 text-stone-600 hover:bg-amber-200 hover:text-stone-800 border border-dashed border-amber-300'
        }`}
      >
        <span>自定义节奏型</span>
      </button>

      <div className="flex items-center gap-3">
        <span className="text-xs text-stone-400 w-12">速度</span>
        <input
          type="range" min={40} max={200} step={5} value={bpm}
          onChange={e => onBpmChange(Number(e.target.value))}
          className="flex-1 accent-amber-500"
        />
        <span className="text-xs text-stone-500 w-14">{bpm} BPM</span>
      </div>

      <button
        onClick={() => isPlaying ? onStop() : onPlay(position, pattern, bpm)}
        className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 ${
          isPlaying
            ? 'bg-amber-100 text-stone-600 border border-amber-200 hover:bg-amber-200'
            : 'bg-amber-500 text-stone-50 hover:bg-amber-600'
        }`}
      >
        {isPlaying
          ? <><IconStop className="w-4 h-4" /> 停止</>
          : <><IconPlay className="w-4 h-4" /> 播放伴奏</>
        }
      </button>
    </div>
  )
}
