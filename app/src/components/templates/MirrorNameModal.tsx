import { useState } from 'react'
import { CheckIcon, NoIcon } from '../icons'

interface MirrorNameModalProps {
  defaultName: string
  onConfirm: (name: string) => void
  onCancel: () => void
}

export function MirrorNameModal({ defaultName, onConfirm, onCancel }: MirrorNameModalProps) {
  const [name, setName] = useState(defaultName)

  return (
    <div className="absolute inset-0 z-20 flex items-start justify-center bg-black/60 pt-24">
      <div className="w-[360px] max-w-[90vw] rounded-standard bg-panel">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <button onClick={onCancel} className="text-muted hover:text-text" aria-label="Cancel">
            <NoIcon />
          </button>
          <span className="text-sm font-bold uppercase tracking-widest">Mirror Formation</span>
          <button onClick={() => onConfirm(name.trim())} disabled={!name.trim()} className="text-accent-teal disabled:opacity-40" aria-label="Confirm">
            <CheckIcon />
          </button>
        </div>
        <div className="p-4">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New formation name"
            className="w-full rounded-standard bg-app-bg px-3 py-2 text-sm outline-none"
          />
        </div>
      </div>
    </div>
  )
}
