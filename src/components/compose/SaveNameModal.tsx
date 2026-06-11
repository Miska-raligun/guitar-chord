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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-stone-900/25 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-white border border-amber-200 rounded-2xl p-5 shadow-xl shadow-amber-200/30"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-sm font-semibold text-stone-800 mb-1">保存编曲</div>
        <div className="text-xs text-stone-400 mb-4">为这段编曲起一个名字</div>

        <input
          autoFocus
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="未命名编曲"
          className="w-full bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-300/40 mb-4 placeholder:text-stone-400"
        />

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-amber-100 text-stone-500 text-sm hover:bg-amber-200 hover:text-stone-700"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 text-stone-50 font-semibold text-sm hover:bg-amber-600"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
