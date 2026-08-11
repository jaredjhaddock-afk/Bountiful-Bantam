import { useState } from 'react'
import type { Unit } from '../../types/play'
import { usePlaybook } from '../../state/playbookStore'
import { CheckIcon, NoIcon } from '../icons'

interface NewCategoryModalProps {
  unit: Unit
  onClose: () => void
}

export function NewCategoryModal({ unit, onClose }: NewCategoryModalProps) {
  const { createCategory } = usePlaybook()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createCategory({ name: name.trim(), unit })
      onClose()
    } catch {
      setError('Could not save this category. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="absolute inset-0 z-10 flex items-start justify-center bg-black/60 pt-24">
      <div className="w-[360px] max-w-[90vw] rounded-standard bg-panel">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <button onClick={onClose} className="text-muted hover:text-text" aria-label="Cancel">
            <NoIcon />
          </button>
          <span className="text-sm font-bold uppercase tracking-widest">New Category</span>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="text-accent-teal disabled:opacity-40" aria-label="Confirm">
            <CheckIcon />
          </button>
        </div>
        <div className="p-4">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            className="w-full rounded-standard bg-app-bg px-3 py-2 text-sm outline-none"
          />
          {error && <p className="mt-2 text-xs text-alert-red">{error}</p>}
        </div>
      </div>
    </div>
  )
}
