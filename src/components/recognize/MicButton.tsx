interface Props {
  isListening: boolean
  onStart: () => void
  onStop: () => void
}

export default function MicButton({ isListening, onStart, onStop }: Props) {
  return (
    <button
      onClick={isListening ? onStop : onStart}
      className={`flex flex-col items-center justify-center w-24 h-24 rounded-full border-4 transition-all ${
        isListening
          ? 'border-red-500 bg-red-500/10 text-red-400 animate-pulse'
          : 'border-amber-500 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
      }`}
    >
      <span className="text-3xl">{isListening ? '🛑' : '🎙️'}</span>
      <span className="text-xs mt-1">{isListening ? '停止' : '开始'}</span>
    </button>
  )
}
