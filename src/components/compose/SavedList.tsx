import { useRef, useState } from 'react'
import { IconX, IconLibrary, IconDownload, IconUpload } from '../ui/icons'
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
  onExport: () => void
  onImport: (file: File) => Promise<number>
  onClose: () => void
}

export default function SavedList({ list, onLoad, onDelete, onExport, onImport, onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null)
  const [importing, setImporting] = useState(false)

  function showFeedback(msg: string, ok: boolean) {
    setFeedback({ msg, ok })
    setTimeout(() => setFeedback(null), 2500)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // reset so the same file can be re-selected
    e.target.value = ''
    setImporting(true)
    try {
      const count = await onImport(file)
      showFeedback(`已导入 ${count} 首编曲`, true)
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : '导入失败', false)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-zinc-900 border-t border-zinc-700/60 rounded-t-2xl pb-8 shadow-xl"
        style={{ maxHeight: '70vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <IconLibrary className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-semibold text-zinc-200">曲库</span>
            {list.length > 0 && (
              <span className="text-xs text-zinc-500">({list.length})</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Import */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              title="从 JSON 文件导入编曲"
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-40 px-2 py-1 rounded hover:bg-zinc-800"
            >
              <IconUpload className="w-3.5 h-3.5" />
              导入
            </button>
            {/* Export */}
            <button
              onClick={onExport}
              disabled={list.length === 0}
              title="导出所有编曲为 JSON 文件"
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-30 px-2 py-1 rounded hover:bg-zinc-800"
            >
              <IconDownload className="w-3.5 h-3.5" />
              导出
            </button>
            <button onClick={onClose} className="text-zinc-500 text-xs hover:text-zinc-300 ml-1">关闭</button>
          </div>
        </div>

        {/* Import feedback */}
        {feedback && (
          <div className={`mx-4 mt-2 px-3 py-2 rounded-lg text-xs ${
            feedback.ok
              ? 'bg-green-500/15 text-green-400 border border-green-500/30'
              : 'bg-red-500/15 text-red-400 border border-red-500/30'
          }`}>
            {feedback.msg}
          </div>
        )}

        {list.length === 0 ? (
          <p className="text-center text-zinc-600 text-sm py-12">
            暂无保存的编曲<br />
            <span className="text-xs mt-1 block">可点击「导入」从文件加载</span>
          </p>
        ) : (
          <div className="overflow-y-auto scrollbar-none" style={{ maxHeight: 'calc(70vh - 52px)' }}>
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
                  className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-zinc-500 hover:text-red-400 hover:bg-red-400/10"
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
