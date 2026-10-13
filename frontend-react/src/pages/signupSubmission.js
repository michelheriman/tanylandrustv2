export function acquireSubmissionLock(lock) {
  if (lock.current) return false
  lock.current = true
  return true
}

export function releaseSubmissionLock(lock) {
  lock.current = false
}
