const FOCUSABLE_SELECTOR = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
const EDITABLE_SELECTOR = 'input:not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled])'

function getFocusableElements(dialog) {
  return Array.from(dialog?.querySelectorAll(FOCUSABLE_SELECTOR) ?? []).filter((element) => (
    !element.disabled && !element.hidden && element.getAttribute?.('aria-hidden') !== 'true'
  ))
}

export function focusFirstDialogField(dialog) {
  if (!dialog) return
  const target = dialog.querySelector(EDITABLE_SELECTOR) ?? getFocusableElements(dialog)[0] ?? dialog
  target.focus()
}

export function restoreDialogFocus(trigger) {
  if (!trigger || trigger.isConnected === false) return
  trigger.focus()
}

export function handleDialogKeydown(event, dialog, onEscape) {
  if (event.key === 'Escape') {
    onEscape?.()
    return true
  }
  if (event.key !== 'Tab') return false

  const focusableElements = getFocusableElements(dialog)
  if (focusableElements.length === 0) {
    event.preventDefault()
    dialog?.focus()
    return true
  }

  const first = focusableElements[0]
  const last = focusableElements[focusableElements.length - 1]
  const active = dialog?.ownerDocument?.activeElement
  const activeIsInside = Boolean(dialog?.contains(active))

  if (event.shiftKey && (active === first || !activeIsInside)) {
    event.preventDefault()
    last.focus()
    return true
  }
  if (!event.shiftKey && (active === last || !activeIsInside)) {
    event.preventDefault()
    first.focus()
    return true
  }
  return false
}
