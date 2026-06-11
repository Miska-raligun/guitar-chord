import { IconX, IconLibrary } from '../ui/icons'
import type { SavedComposition } from '../../types/compose'

const PATTERN_LABEL: Record<string, string> = {
  '53231323': '民谣',
  'x3231323': '切音',
  '3_12_3':   '古典',
  'strum':    '扫弦',
}

const ROOT_NAMES = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B']

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

interface Props {
  list: SavedComposition[]
  onLoad: (item: SavedComposition) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export default function SavedList({ list, onLoad, onDelete, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-zinc-900 border-t border-zinc-700/60 rounded-t-2xl pb-8 shadow-xl"
        style={{ maxHeight: '70vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <IconLibrary className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-semibold text-zinc-200">曲库</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 text-xs hover:text-zinc-300">关闭</button>
        </div>

        {list.length === 0 ? (
          <p className="text-center text-zinc-600 text-sm py-12">暂无保存的编曲</p>
        ) : (
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 52px)' }}>
            {list.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800/50 hover:bg-zinc-800/30"
              >
                <button
                  className="flex-1 text-left min-w-0"
                  onClick={() => onLoad(item)}
                >
                  <div className="text-sm text-zinc-200 font-medium truncate">{item.name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5 font-mono">
                    {ROOT_NAMES[item.keyRoot]} · {PATTERN_LABEL[item.pattern] ?? item.pattern} · {item.bpm} BPM · {formatDate(item.savedAt)}
                  </div>
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-zinc-600 hover:text-red-400 hover:bg-red-400/10"
                >
                  <IconX className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
