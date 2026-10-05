import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { focusFirstDialogField, handleDialogKeydown, restoreDialogFocus } from './mainDialogFocus.js'

function makeDialog() {
  const document = { activeElement: null }
  const makeElement = ({ editable = false, disabled = false } = {}) => {
    const element = {
      editable,
      disabled,
      hidden: false,
      isConnected: true,
      getAttribute: () => null,
      focus() { document.activeElement = element },
    }
    return element
  }
  const firstField = makeElement({ editable: true })
  const closeButton = makeElement()
  const saveButton = makeElement()
  const elements = [firstField, closeButton, saveButton]
  const dialog = {
    ownerDocument: document,
    querySelector: () => firstField,
    querySelectorAll: () => elements,
    contains: (element) => elements.includes(element),
    focus() { document.activeElement = dialog },
  }
  return { dialog, document, firstField, closeButton, saveButton, makeElement }
}

function tabEvent({ shiftKey = false } = {}) {
  return { key: 'Tab', shiftKey, prevented: false, preventDefault() { this.prevented = true } }
}

test('opening Edit focuses its first editable field', () => {
  const { dialog, document, firstField } = makeDialog()
  focusFirstDialogField(dialog)
  assert.equal(document.activeElement, firstField)
})

test('Tab from the final dialog control wraps to the first', () => {
  const { dialog, document, firstField, saveButton } = makeDialog()
  document.activeElement = saveButton
  const event = tabEvent()
  assert.equal(handleDialogKeydown(event, dialog), true)
  assert.equal(event.prevented, true)
  assert.equal(document.activeElement, firstField)
})

test('Shift+Tab from the first dialog control wraps to the final control', () => {
  const { dialog, document, firstField, saveButton } = makeDialog()
  document.activeElement = firstField
  const event = tabEvent({ shiftKey: true })
  assert.equal(handleDialogKeydown(event, dialog), true)
  assert.equal(event.prevented, true)
  assert.equal(document.activeElement, saveButton)
})

test('Escape invokes the dialog close action', () => {
  const { dialog } = makeDialog()
  let closed = false
  assert.equal(handleDialogKeydown({ key: 'Escape' }, dialog, () => { closed = true }), true)
  assert.equal(closed, true)
})

test('closing restores focus to the opener and Main wires the focus lifecycle', () => {
  const { document, makeElement } = makeDialog()
  const opener = makeElement()
  document.activeElement = opener
  restoreDialogFocus(opener)
  assert.equal(document.activeElement, opener)

  const mainSource = readFileSync(new URL('./Main.jsx', import.meta.url), 'utf8')
  assert.match(mainSource, /editTriggerRef\.current = trigger \?\? document\.activeElement/)
  assert.match(mainSource, /focusFirstDialogField\(editDialogRef\.current\)/)
  assert.match(mainSource, /restoreDialogFocus\(editTriggerRef\.current\)/)
  assert.match(mainSource, /handleDialogKeydown\(event, editDialogRef\.current, closeEdit\)/)
  assert.match(mainSource, /ref=\{editDialogRef\}[^>]*role="dialog" aria-modal="true"/)
})

test('Chat admin dialog uses the shared focus lifecycle and preserves its successful-send flow', () => {
  const chatSource = readFileSync(new URL('./Chat.jsx', import.meta.url), 'utf8')
  assert.match(chatSource, /import \{ focusFirstDialogField, handleDialogKeydown, restoreDialogFocus \} from '\.\/mainDialogFocus\.js'/)
  assert.match(chatSource, /adminTriggerRef\.current = event\.currentTarget/)
  assert.match(chatSource, /focusFirstDialogField\(adminDialogRef\.current\)/)
  assert.match(chatSource, /restoreDialogFocus\(adminTriggerRef\.current\)/)
  assert.match(chatSource, /handleDialogKeydown\(event, adminDialogRef\.current, \(\) => \{/)
  assert.match(chatSource, /if \(!adminSending\) setAdminOpen\(false\)/)
  assert.match(chatSource, /ref=\{adminDialogRef\}[^>]*role="dialog" aria-modal="true"/)

  assert.match(chatSource, /await postAdminMessage\(request, user\.email, adminSubject, adminContent, globalThis\.crypto\.randomUUID\(\)\)/)
  assert.match(chatSource, /setAdminSubject\(''\)\s*setAdminContent\(''\)\s*setAdminOpen\(false\)\s*setConversationsLoading\(true\)\s*setConversationRetry/)
  assert.match(chatSource, /setMessages\(\(current\) => \[\.\.\.current, \{ \.\.\.body, created_at: t\.now, localEcho: true \}\]\)/)
  assert.match(chatSource, /endOfMessages\.current\?\.scrollIntoView/)
})
