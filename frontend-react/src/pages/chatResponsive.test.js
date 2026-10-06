import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const chatCss = await readFile(fileURLToPath(new URL('./Chat.css', import.meta.url)), 'utf8')
const chatSource = await readFile(fileURLToPath(new URL('./Chat.jsx', import.meta.url)), 'utf8')
const mainCss = await readFile(fileURLToPath(new URL('./Main.css', import.meta.url)), 'utf8')
const mobileChat = cssBlock(chatCss, '@media (max-width: 700px)')
const mobileMain = cssBlock(mainCss, '@media (max-width: 700px)')

function cssBlock(source, marker) {
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `expected CSS block: ${marker}`)
  const open = source.indexOf('{', start)
  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(start, index + 1)
  }
  assert.fail(`unterminated CSS block: ${marker}`)
}

function cssRule(source, selector) {
  const marker = `${selector} {`
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `expected CSS rule: ${selector}`)
  return cssBlock(source, marker)
}

test('mobile Chat secondary text is enlarged while desktop typography remains unchanged', () => {
  for (const [width, height] of [[390, 844], [375, 812], [360, 800], [320, 568]]) {
    assert.ok(width <= 700, `${width}x${height} uses the mobile Chat breakpoint`)
  }

  assert.match(cssRule(mobileChat, '.chat-react-conversation-copy strong, .chat-react-conversation-copy small'), /font-size:\s*10px/)
  assert.match(cssRule(mobileChat, '.chat-react-contact-copy p, .chat-react-online'), /font-size:\s*10px/)
  assert.match(cssRule(mobileChat, '.chat-react-bubble strong'), /font-size:\s*10px/)
  assert.match(cssRule(mobileChat, '.chat-react-bubble time'), /font-size:\s*9px/)
  assert.match(cssRule(mobileChat, '.chat-react-search input'), /font-size:\s*10px/)
  assert.match(cssRule(mobileChat, '.chat-react-compose-error'), /font-size:\s*10px/)

  assert.match(cssRule(chatCss, '.chat-react-conversation-copy strong'), /font-size:\s*9px/)
  assert.match(chatCss, /\.chat-react-conversation-copy small\s*\{[^}]*font-size:\s*8px/)
  assert.match(cssRule(chatCss, '.chat-react-bubble time'), /font-size:\s*7px/)
})

test('mobile Chat keeps standard action targets and sizes the admin trigger independently', () => {
  const desktopAdminTrigger = cssRule(chatCss, '.chat-react-admin-trigger')
  assert.match(desktopAdminTrigger, /width:\s*28px;\s*height:\s*28px/)
  assert.match(cssRule(chatCss, '.chat-react-admin-trigger svg'), /width:\s*17px;\s*height:\s*17px/)
  assert.match(desktopAdminTrigger, /display:\s*grid[^}]*place-items:\s*center/)
  assert.match(desktopAdminTrigger, /border-radius:\s*50%/)

  for (const selector of [
    '.chat-react-compose button',
    '.chat-react-modal-close',
  ]) {
    const rule = cssRule(mobileChat, selector)
    assert.match(rule, /(?:min-)?width:\s*44px/)
    assert.match(rule, /(?:min-)?height:\s*44px/)
  }
  const mobileAdminTrigger = cssRule(mobileChat, '.chat-react-admin-trigger')
  assert.match(mobileAdminTrigger, /width:\s*32px;\s*height:\s*32px;\s*min-width:\s*32px;\s*min-height:\s*32px/)
  assert.match(cssRule(mobileChat, '.chat-react-admin-actions button'), /min-height:\s*44px/)
  assert.match(cssRule(mobileChat, '.chat-react-error button'), /min-height:\s*44px/)
  assert.match(cssRule(chatCss, '.chat-react-admin-trigger svg'), /display:\s*block;\s*width:\s*17px;\s*height:\s*17px;[^}]*stroke-width:\s*2/)
  assert.match(cssRule(mobileChat, '.chat-react-admin-trigger svg'), /width:\s*14px;\s*height:\s*14px/)
  assert.match(chatSource, /<svg viewBox="2 2 20 20" aria-hidden="true"><path d="M20\.5 11\.5/)
  assert.match(cssRule(chatCss, '.chat-react-compose button svg'), /width:\s*17px;\s*height:\s*17px/)
})

test('mobile admin dialog scrolls within the dynamic viewport and keeps its focus behavior', () => {
  const dialog = cssRule(mobileChat, '.chat-react-admin-dialog')
  assert.match(dialog, /max-height:\s*calc\(100vh\s*-\s*32px\)/)
  assert.match(dialog, /max-height:\s*calc\(100dvh\s*-\s*32px\)/)
  assert.match(dialog, /overflow-y:\s*auto/)
  assert.match(chatCss, /\.chat-react-modal-backdrop\s*\{[^}]*position:\s*fixed[^}]*z-index:\s*70/)

  assert.match(chatSource, /role="dialog" aria-modal="true"/)
  assert.match(chatSource, /focusFirstDialogField\(adminDialogRef\.current\)/)
  assert.match(chatSource, /handleDialogKeydown\(event, adminDialogRef\.current/)
  assert.match(chatSource, /restoreDialogFocus\(adminTriggerRef\.current\)/)
})

test('mobile conversation carousel, message history, composer and navigation clearance remain intact', () => {
  const conversationList = cssRule(mobileChat, '.chat-react-conversation-list')
  assert.match(conversationList, /flex-direction:\s*row/)
  assert.match(conversationList, /overflow-x:\s*auto/)
  assert.match(conversationList, /overflow-y:\s*hidden/)
  assert.match(cssRule(mobileChat, '.chat-react-conversation'), /min-width:\s*160px/)

  assert.match(cssRule(chatCss, '.chat-react-workspace'), /min-width:\s*0/)
  assert.match(cssRule(chatCss, '.chat-react-workspace'), /overflow:\s*hidden/)
  assert.match(cssRule(chatCss, '.chat-react-bubble'), /overflow-wrap:\s*anywhere/)
  assert.match(cssRule(chatCss, '.chat-react-messages'), /overflow-y:\s*auto/)
  assert.match(cssRule(chatCss, '.chat-react-compose input'), /height:\s*37px/)
  assert.match(cssRule(mobileMain, '.main-content'), /padding:\s*10px\s+10px\s+88px/)
  assert.match(cssRule(mobileMain, '.main-mobile-nav'), /position:\s*fixed[^}]*z-index:\s*25/)
})
