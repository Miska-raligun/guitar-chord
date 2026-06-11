import { useRecognizer } from '../../hooks/useRecognizer'
import MicButton from './MicButton'
import LiveChordDisplay from './LiveChordDisplay'
import MatchList from './MatchList'

export default function RecognizeTab() {
  const { isListening, matches, error, start, stop } = useRecognizer()
  const topMatch = matches.length > 0 && matches[0].confidence > 0.3 ? matches[0] : null

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-6">
      <div className="flex flex-col items-center gap-2">
        <MicButton isListening={isListening} onStart={start} onStop={stop} />
        {isListening && (
          <div className="flex items-center gap-1 text-xs text-stone-500">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
            正在监听...
          </div>
        )}
      </div>

      {error && (
        <div className="w-full text-center text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
          {error}
        </div>
      )}

      <div className="w-full max-w-sm">
        <LiveChordDisplay match={topMatch} />
      </div>

      {matches.length > 0 && (
        <div className="w-full max-w-sm">
          <div className="text-xs text-stone-400 mb-2 uppercase tracking-wider">候选匹配</div>
          <MatchList matches={matches} topRoot={topMatch?.root ?? null} />
        </div>
      )}

      {!isListening && !error && matches.length === 0 && (
        <div className="text-center text-stone-400 text-sm max-w-xs">
          点击麦克风按钮开始识别，然后在吉他上弹奏任意和弦
        </div>
      )}
    </div>
  )
}
