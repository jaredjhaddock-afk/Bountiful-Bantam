interface DeleteConfirmModalProps {
  itemName: string
  blockedByNames?: string[]
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmModal({ itemName, blockedByNames, onConfirm, onCancel }: DeleteConfirmModalProps) {
  const blocked = !!blockedByNames && blockedByNames.length > 0

  return (
    <div className="absolute inset-0 z-20 flex items-start justify-center bg-black/60 pt-24">
      <div className="w-[360px] max-w-[90vw] rounded-standard bg-panel">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-bold">
          {blocked ? `Can't delete "${itemName}"` : `Delete "${itemName}"?`}
        </div>
        <div className="p-4 text-sm text-muted">
          {blocked ? (
            <>
              <p className="mb-2">Used by: {blockedByNames!.join(', ')}</p>
              <p>Reassign or delete those plays first.</p>
            </>
          ) : (
            <p>This can't be undone.</p>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 pt-0">
          {blocked ? (
            <button onClick={onCancel} className="rounded-standard bg-app-bg px-3 py-2 text-sm text-text">
              OK
            </button>
          ) : (
            <>
              <button onClick={onCancel} className="rounded-standard bg-app-bg px-3 py-2 text-sm text-muted">
                Cancel
              </button>
              <button onClick={onConfirm} className="rounded-standard bg-alert-red px-3 py-2 text-sm font-bold text-white">
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
