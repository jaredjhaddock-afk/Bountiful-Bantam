/** One more than the highest of the given numbers, or 1 if the list is empty. Used to assign
 *  a new play's number to one past whatever's currently highest in its unit. */
export function nextPlayNumber(existingNumbers: number[]): number {
  if (existingNumbers.length === 0) return 1
  return Math.max(...existingNumbers) + 1
}

/** True if `candidate` is already used by a play other than `excludePlayId` (typically the
 *  play currently being renumbered, so its own existing number doesn't flag as a conflict). */
export function isNumberTaken(plays: { id: string; number: number }[], candidate: number, excludePlayId: string): boolean {
  return plays.some((p) => p.id !== excludePlayId && p.number === candidate)
}

/**
 * Given the current ordered list of ids and the id being dragged, returns the new full ordered
 * list with the dragged id moved to `newIndex`. The returned array's index of each id is what
 * gets written back as that item's sortOrder after a drag-and-drop reorder.
 */
export function reorderIds(ids: string[], draggedId: string, newIndex: number): string[] {
  const withoutDragged = ids.filter((id) => id !== draggedId)
  const clampedIndex = Math.max(0, Math.min(newIndex, withoutDragged.length))
  return [...withoutDragged.slice(0, clampedIndex), draggedId, ...withoutDragged.slice(clampedIndex)]
}
