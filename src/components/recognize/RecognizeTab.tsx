import { useEffect, useState } from 'react'
import { useRecognizer } from '../../hooks/useRecognizer'
import MicButton from './MicButton'
import LiveChordDisplay from './LiveChordDisplay'
import MatchList from './MatchList'

export default function RecognizeTab() {
  const { isListening, matches, error, start, stop } = useRecognizer()
  // Only display results with meaningful confidence — below 0.3 is likely noise
  const topMatch = matches.length > 0 && matches[0].confidence > 0.3 ? matches[0] : null

  const [positionIndex, setPositionIndex] = useState(0)
  useEffect(() => {
    setPositionIndex(0)
  }, [topMatch?.root, topMatch?.suffix])

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-6">
      <div className="flex flex-col items-center gap-2">
        <MicButton isListening={isListening} onStart={start} onStop={stop} />
        {isListening && (
          <div className="flex items-center gap-1 text-xs text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
            正在监听...
          </div>
        )}
      </div>

      {error && (
        <div className="w-full max-w-sm flex flex-col items-center gap-2 text-center text-sm text-red-400 bg-red-400/10 rounded-lg px-4 py-2">
          <span>{error}</span>
          <button
            onClick={start}
            className="px-3 py-1 rounded-md text-xs font-medium bg-red-400/20 hover:bg-red-400/30 text-red-300"
          >
            重试
          </button>
        </div>
      )}

      <div className="w-full max-w-sm">
        <LiveChordDisplay match={topMatch} positionIndex={positionIndex} onPositionIndexChange={setPositionIndex} />
      </div>

      {matches.length > 0 && (
        <div className="w-full max-w-sm">
          <div className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">候选匹配</div>
          <MatchList matches={matches} topRoot={topMatch?.root ?? null} />
        </div>
      )}

      {!isListening && !error && matches.length === 0 && (
        <div className="text-center text-zinc-600 text-sm max-w-xs">
          点击麦克风按钮开始识别，然后在吉他上弹奏任意和弦
        </div>
      )}
    </div>
  )
}
