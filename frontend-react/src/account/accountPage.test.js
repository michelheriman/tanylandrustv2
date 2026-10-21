import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const accountPage = readFileSync(new URL('./AccountPage.jsx', import.meta.url), 'utf8')
const main = readFileSync(new URL('../pages/Main.jsx', import.meta.url), 'utf8')
const labels = readFileSync(new URL('./accountLabels.js', import.meta.url), 'utf8')

test('account menu navigates to real profile and offer pages and reuses the existing sign-out flow', () => {
  assert.match(main, /accountPageHash\('profile'\)/)
  assert.match(main, /accountPageHash\('offer'\)/)
  assert.match(main, /<AccountPage page=\{accountPage\}/)
  assert.match(main, /async function signOut\(\)\s*\{\s*await logout\(\)\s*window\.location\.replace\('\/signin'\)/)
  assert.match(main, /<button type="button" onClick=\{\(\) => void signOut\(\)\}/)
  assert.doesNotMatch(main, /className="main-logout"/)
})

test('account menu supports Escape, outside-pointer dismissal and visible trigger state', () => {
  assert.match(main, /aria-expanded=\{accountMenuOpen\}/)
  assert.match(main, /aria-controls="main-account-panel"/)
  assert.match(main, /document\.addEventListener\('pointerdown', onPointerDown\)/)
  assert.match(main, /window\.addEventListener\('keydown', onKeyDown\)/)
  assert.match(main, /accountMenuTriggerRef\.current\?\.focus\(\)/)
  assert.match(main, /hidden=\{!accountMenuOpen\}/)
  assert.match(main, /main-account-initials[^>]*>CL<\/span>/)
  assert.match(main, /main-account-name[^>]*>\{lang === 'fr' \? 'Compte' : 'Account'\}/)
  assert.match(main, /<strong>\{displayName\}<\/strong>/)
  assert.doesNotMatch(main, /main-account-name[^>]*>\{displayName\}/)
})

test('language picker stays outside the account popover and responsive navigation switches before collision', () => {
  const languagePosition = main.indexOf('<details className="main-language-menu">')
  const accountPosition = main.indexOf('<div className="main-account-menu"')
  assert.ok(languagePosition >= 0 && accountPosition > languagePosition)
  assert.match(main, /setLang\(language\)/)
  const styles = readFileSync(new URL('../pages/Main.css', import.meta.url), 'utf8')
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\)/)
  assert.match(styles, /@media \(max-width: 860px\)[\s\S]*?\.main-desktop-nav \{ display: none; \}/)
  assert.match(styles, /@media \(max-width: 420px\)[\s\S]*?\.main-account-name \{ display: none; \}/)
  assert.match(styles, /@media \(max-width: 420px\)[\s\S]*?\.main-language-menu summary svg \{ display: none; \}/)
})

test('profile and offer pages have loading, error, retry and returned-data states', () => {
  assert.match(accountPage, /viewState\.status === 'loading'/)
  assert.match(accountPage, /viewState\.status === 'error'/)
  assert.match(accountPage, /onRetry=\{\(\) => setReload/)
  assert.match(accountPage, /viewState\.status === 'ready'/)
  assert.match(accountPage, /<ProfileDetails profile=\{viewState\.data\}/)
  assert.match(accountPage, /<OfferDetails offer=\{viewState\.data\}/)
})

test('account UI labels test grants as unpaid and exposes no payment or cancellation action', () => {
  assert.match(labels, /testGrant:/)
  assert.match(labels, /not a paid subscription/)
  assert.match(labels, /ce n’est pas un abonnement payé/)
  assert.match(labels, /Payment, invoices, renewal, and cancellation are not available here/)
  assert.match(labels, /Paiement, factures, renouvellement et résiliation ne sont pas disponibles ici/)
  assert.doesNotMatch(accountPage, /<button[^>]+(Pay|Renew|Cancel subscription|Payer|Renouveler|Résilier)/i)
})

test('profile page renders only real profile display fields, never authentication data', () => {
  assert.match(accountPage, /labels\.name, profile\.name/)
  assert.match(accountPage, /labels\.username, profile\.username/)
  assert.match(accountPage, /labels\.email, profile\.email/)
  assert.doesNotMatch(accountPage, /password_hash|refresh_token|access_token|credential/i)
})
