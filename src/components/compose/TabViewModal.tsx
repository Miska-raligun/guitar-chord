import { useState } from 'react'
import { downloadTab } from '../../utils/tabExport'

interface Props {
  text: string
  onClose: () => void
}

export default function TabViewModal({ text, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <span className="text-sm text-zinc-200 font-medium">六线谱</span>
          <div className="flex gap-2">
            <button
              onClick={copy}
              className={`px-3 py-1.5 rounded-lg text-xs ${
                copied ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >{copied ? '已复制！' : '复制'}</button>
            <button
              onClick={() => downloadTab(text)}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700"
            >下载 .txt</button>
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-zinc-400 text-xs hover:text-zinc-200 hover:bg-zinc-800">关闭</button>
          </div>
        </div>
        <div className="overflow-auto p-4">
          <pre className="text-[11px] leading-snug text-zinc-300 font-mono whitespace-pre">{text}</pre>
        </div>
      </div>
    </div>
  )
}
