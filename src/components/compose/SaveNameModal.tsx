import { useState } from 'react'

interface Props {
  defaultName?: string
  onSave: (name: string) => void
  onClose: () => void
}

export default function SaveNameModal({ defaultName = '', onSave, onClose }: Props) {
  const [name, setName] = useState(defaultName)

  function handleSave() {
    onSave(name.trim() || '未命名编曲')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-zinc-900 border border-zinc-700/60 rounded-2xl p-5 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-sm font-semibold text-zinc-200 mb-1">保存编曲</div>
        <div className="text-xs text-zinc-500 mb-4">为这段编曲起一个名字</div>

        <input
          autoFocus
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="未命名编曲"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-amber-500/50 mb-4 placeholder:text-zinc-600"
        />

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-zinc-800 text-zinc-400 text-sm hover:bg-zinc-700 hover:text-zinc-200"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-lg bg-amber-500 text-zinc-950 font-semibold text-sm hover:bg-amber-400"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
