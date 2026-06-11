import { IconMic, IconMicOff } from '../ui/icons'

interface Props {
  isListening: boolean
  onStart: () => void
  onStop: () => void
}

export default function MicButton({ isListening, onStart, onStop }: Props) {
  return (
    <button
      onClick={isListening ? onStop : onStart}
      className={`flex flex-col items-center justify-center w-24 h-24 rounded-full border-2 transition-all ${
        isListening
          ? 'border-red-500/60 bg-red-500/10 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
          : 'border-amber-500/50 bg-amber-500/8 text-amber-400 hover:bg-amber-500/15 hover:border-amber-500/70'
      }`}
    >
      {isListening
        ? <IconMicOff className="w-7 h-7" />
        : <IconMic className="w-7 h-7" />
      }
      <span className="text-[11px] mt-1.5 font-medium tracking-wide">
        {isListening ? '停止' : '开始'}
      </span>
    </button>
  )
}
