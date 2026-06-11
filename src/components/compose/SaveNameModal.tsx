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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-sm font-semibold text-zinc-200 mb-3">保存编曲</div>

        <input
          autoFocus
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="给这段编曲起个名字..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-amber-500 mb-4"
        />

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-lg bg-amber-500 text-zinc-950 font-semibold text-sm hover:bg-amber-400 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
