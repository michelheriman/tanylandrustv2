import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { legalPageMarkup, TERMS_DOCUMENT_URL, TERMS_QR_LIBRARY_URL } from './legalPageData.js'
import { readLanguage, writeLanguage } from '../languageStorage.js'

const legalContentDirectory = new URL('../legal-content/', import.meta.url)

function extractMediaBlock(stylesheet, query) {
  const start = stylesheet.lastIndexOf(query)
  assert.notEqual(start, -1, `missing ${query}`)
  const open = stylesheet.indexOf('{', start)
  let depth = 1
  for (let index = open + 1; index < stylesheet.length; index += 1) {
    if (stylesheet[index] === '{') depth += 1
    if (stylesheet[index] === '}') depth -= 1
    if (depth === 0) return stylesheet.slice(open + 1, index)
  }
  assert.fail(`unclosed ${query}`)
}

function plainText(markup) {
  return markup.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

test('Terms React content retains both language versions and accordion sections without executing legacy scripts', async () => {
  const source = await readFile(new URL('terms.html', legalContentDirectory), 'utf8')
  const markup = legalPageMarkup(source, 'terms')
  assert.match(markup, /Conditions d'utilisation/)
  assert.match(markup, /Terms of Use/)
  assert.match(markup, /class="lang-fr visible"/)
  assert.match(markup, /class="lang-en"/)
  assert.match(markup, /class="term-card open"/)
  assert.match(markup, /class="term-card-header"/)
  assert.equal((markup.match(/<h2 class="section-label"/g) || []).length, 8)
  assert.equal((markup.match(/<h3 class="term-card-heading"><button type="button" class="term-card-header"/g) || []).length, 8)
  assert.doesNotMatch(markup, /<p class="section-label"|<div class="term-card-header"/)
  const accordionButtonContents = [...markup.matchAll(/<button[^>]*class="term-card-header"[^>]*>([\s\S]*?)<\/button>/g)]
  assert.equal(accordionButtonContents.length, 8)
  assert.equal(accordionButtonContents.some(([, contents]) => /<div\b/.test(contents)), false)
  assert.doesNotMatch(markup, /<script\b|onclick=/i)
  assert.match(markup, /href="\/privacy"/)
  assert.equal([...markup].some((character) => {
    const codePoint = character.codePointAt(0)
    return (codePoint >= 0x1f000 && codePoint <= 0x1faff) || codePoint === 0x2713
  }), false)
  assert.doesNotMatch(markup, /<svg(?![^>]*aria-hidden="true")/)
  assert.equal((markup.match(/class="card-icon"/g) || []).length, 8)
  assert.equal((markup.match(/class="card-icon"[^>]*>[\s\S]*?<svg /g) || []).length, 8)
  const sourceSectionLabels = [...source.matchAll(/<p class="section-label"[^>]*>([\s\S]*?)<\/p>/g)].map(([, label]) => plainText(label))
  const reactSectionLabels = [...markup.matchAll(/<h2 class="section-label"[^>]*>([\s\S]*?)<\/h2>/g)].map(([, label]) => plainText(label))
  assert.deepEqual(reactSectionLabels, sourceSectionLabels)
  const sourceCardTitles = [...source.matchAll(/<div class="card-title">([\s\S]*?)<\/div>\s*<span class="chevron">/g)].map(([, title]) => plainText(title))
  const reactCardTitles = [...markup.matchAll(/<span class="card-title">([\s\S]*?)<\/span>\s*<span class="chevron">/g)].map(([, title]) => plainText(title))
  assert.deepEqual(reactCardTitles, sourceCardTitles)
  assert.match(markup, /class="legal-inline-icon"[^>]*>[\s\S]*?Document officiel complet/)
  assert.doesNotMatch(markup, /🇫🇷|🇬🇧|📄|↗|<span class="chevron">▼/)
  assert.match(source, new RegExp(TERMS_DOCUMENT_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(source, new RegExp(TERMS_QR_LIBRARY_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('Terms and Privacy use the React-owned logo asset without legacy URLs', async () => {
  const [termsSource, privacySource] = await Promise.all([
    readFile(new URL('terms.html', legalContentDirectory), 'utf8'),
    readFile(new URL('privacy.html', legalContentDirectory), 'utf8'),
  ])
  const [termsMarkup, privacyMarkup] = [
    legalPageMarkup(termsSource, 'terms'),
    legalPageMarkup(privacySource, 'privacy'),
  ]

  for (const markup of [termsMarkup, privacyMarkup]) {
    assert.match(markup, /src="\/assets\/logo_\.png"/)
    assert.doesNotMatch(markup, /\/legacy\//)
  }
})

test('Vite no longer configures publishing of the Vanilla legacy directory', async () => {
  const config = await readFile(new URL('../../vite.config.js', import.meta.url), 'utf8')
  assert.match(config, /plugins:\s*\[react\(\)\]/)
  assert.doesNotMatch(config, /legacyPages|legacyFiles|tany-legacy-pages|generateBundle/)
})

test('Privacy React content retains bilingual policy and contact sections with React routes', async () => {
  const source = await readFile(new URL('privacy.html', legalContentDirectory), 'utf8')
  const markup = legalPageMarkup(source, 'privacy')
  assert.match(markup, /Politique de confidentialité|Politique de confidentialit/)
  assert.match(markup, /Privacy Policy/)
  assert.match(markup, /class="lang-fr visible"/)
  assert.match(markup, /class="lang-en"/)
  assert.match(markup, /class="term-card-header"/)
  assert.equal((markup.match(/<h2 class="section-label"/g) || []).length, 9)
  assert.equal((markup.match(/<h3 class="term-card-heading"><button type="button" class="term-card-header"/g) || []).length, 9)
  assert.match(markup, /<h2>\s*<span class="lang-fr visible">Une question sur vos donn/)
  assert.doesNotMatch(markup, /<p class="section-label"|<div class="term-card-header"/)
  const accordionButtonContents = [...markup.matchAll(/<button[^>]*class="term-card-header"[^>]*>([\s\S]*?)<\/button>/g)]
  assert.equal(accordionButtonContents.length, 9)
  assert.equal(accordionButtonContents.some(([, contents]) => /<div\b/.test(contents)), false)
  assert.match(markup, /mailto:raherimanantsoa\.consult@gmail\.com/)
  assert.doesNotMatch(markup, /<script\b|onclick=/i)
  assert.match(markup, /href="\/terms"/)
  assert.equal([...markup].some((character) => {
    const codePoint = character.codePointAt(0)
    return (codePoint >= 0x1f000 && codePoint <= 0x1faff) || codePoint === 0x2713
  }), false)
  assert.doesNotMatch(markup, /<svg(?![^>]*aria-hidden="true")/)
  assert.equal((markup.match(/class="card-icon"/g) || []).length, 9)
  assert.equal((markup.match(/class="card-icon"[^>]*>[\s\S]*?<svg /g) || []).length, 9)
  const sourceSectionLabels = [...source.matchAll(/<p class="section-label"[^>]*>([\s\S]*?)<\/p>/g)].map(([, label]) => plainText(label))
  const reactSectionLabels = [...markup.matchAll(/<h2 class="section-label"[^>]*>([\s\S]*?)<\/h2>/g)].map(([, label]) => plainText(label))
  assert.deepEqual(reactSectionLabels, sourceSectionLabels)
  const sourceCardTitles = [...source.matchAll(/<div class="card-title">([\s\S]*?)<\/div>\s*<span class="chevron">/g)].map(([, title]) => plainText(title))
  const reactCardTitles = [...markup.matchAll(/<span class="card-title">([\s\S]*?)<\/span>\s*<span class="chevron">/g)].map(([, title]) => plainText(title))
  assert.deepEqual(reactCardTitles, sourceCardTitles)
  assert.doesNotMatch(markup, /<div class="card-icon">|<span class="chevron">▼|🇫🇷|🇬🇧/)
  assert.match(markup, /class="pill"><svg class="legal-inline-icon"/)
})

test('Legal page styles constrain mobile sizing and allow text to wrap without clipping', async () => {
  const stylesheet = await readFile(new URL('./LegalPage.css', import.meta.url), 'utf8')
  assert.match(stylesheet, /\.legal-page,\s*\.legal-page \*\s*\{\s*box-sizing:\s*border-box/)
  assert.match(stylesheet, /overflow-wrap:\s*anywhere/)
  assert.doesNotMatch(stylesheet, /overflow-x:\s*hidden/)
  const mobile = extractMediaBlock(stylesheet, '@media (max-width: 600px) {')
  assert.match(stylesheet, /\.legal-page \.lang-btn \{ min-height: 38px;/)
  assert.match(mobile, /\.legal-page \.lang-btn \{ min-height: 44px;/)
  assert.match(mobile, /\.legal-page \.page-footer a \{[\s\S]*?min-height: 44px;[\s\S]*?overflow-wrap: anywhere;/)
  assert.match(mobile, /\.legal-page \.page-footer a \{[\s\S]*?max-width: 100%;/)
})

test('Legal accordions use native buttons inside headings and retain expanded state without custom key handling', async () => {
  const source = await readFile(new URL('./LegalPage.jsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('./LegalPage.css', import.meta.url), 'utf8')

  assert.match(source, /container\.querySelectorAll\('\.term-card-header'\)/)
  assert.match(source, /header\.setAttribute\('aria-expanded', String\(Boolean\(/)
  assert.match(source, /if \(header\) toggleCard\(header\)/)
  assert.match(source, /header\.setAttribute\('aria-expanded', String\(card\.classList\.contains\('open'\)\)\)/)
  assert.doesNotMatch(source, /role', 'button'|setAttribute\('tabindex'|handleKeyDown|onKeyDown=/)
  assert.match(css, /button\.term-card-header:focus-visible \{ outline: 3px solid var\(--legal-gold\); outline-offset: -4px; \}/)
})

test('Sign up and the React app expose direct public Terms and Privacy routes', async () => {
  const [signUpSource, appSource] = await Promise.all([
    readFile(new URL('./SignUp.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../App.jsx', import.meta.url), 'utf8'),
  ])
  assert.match(signUpSource, /href="\/terms"/)
  assert.match(signUpSource, /href="\/privacy"/)
  assert.match(appSource, /pathname === '\/terms'/)
  assert.match(appSource, /pathname === '\/privacy'/)
  assert.match(appSource, /if \(legalDocument\) return <Suspense fallback=\{pageLoadingFallback\}><LegalPage document=\{legalDocument\} \/><\/Suspense>/)
})

test('Terms and Privacy read and save the canonical language preference', async () => {
  const [legalPageSource, appSource] = await Promise.all([
    readFile(new URL('./LegalPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../App.jsx', import.meta.url), 'utf8'),
  ])
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }

  assert.match(legalPageSource, /import \{ readLanguage, writeLanguage \} from '\.\.\/languageStorage\.js'/)
  assert.match(legalPageSource, /useState\(readLanguage\)/)
  assert.match(legalPageSource, /writeLanguage\(nextLanguage\)/)
  assert.match(legalPageSource, /setLanguage\(nextLanguage\)/)
  assert.match(legalPageSource, /const nextLanguage = languageButton\.id === 'btn-fr' \? 'fr' : 'en'/)
  assert.match(legalPageSource, /language === 'fr'/)
  assert.match(legalPageSource, /language === 'en'/)
  assert.match(appSource, /pathname === '\/terms'/)
  assert.match(appSource, /pathname === '\/privacy'/)
  assert.match(appSource, /if \(legalDocument\) return <Suspense fallback=\{pageLoadingFallback\}><LegalPage document=\{legalDocument\} \/><\/Suspense>/)

  writeLanguage('en', storage)
  assert.equal(readLanguage(storage), 'en')
  writeLanguage('fr', storage)
  assert.equal(readLanguage(storage), 'fr')
  writeLanguage('en', storage)
  assert.equal(readLanguage(storage), 'en')
})

test('QR loading fallback follows the selected French or English language', async () => {
  const source = await readFile(new URL('./LegalPage.jsx', import.meta.url), 'utf8')

  assert.match(source, /en: 'The QR code could not be loaded\. Use the official document link above\.'/)
  assert.match(source, /fr: 'Le code QR n’a pas pu être chargé\. Utilisez le lien vers le document officiel ci-dessus\.'/)
  assert.match(source, /\{qrErrorMessages\[language\]\}/)
})
