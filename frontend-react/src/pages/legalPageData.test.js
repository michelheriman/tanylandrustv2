import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { legalPageMarkup, TERMS_DOCUMENT_URL, TERMS_QR_LIBRARY_URL } from './legalPageData.js'

const legalContentDirectory = new URL('../legal-content/', import.meta.url)

test('Terms React content retains both language versions and accordion sections without executing legacy scripts', async () => {
  const source = await readFile(new URL('terms.html', legalContentDirectory), 'utf8')
  const markup = legalPageMarkup(source, 'terms')
  assert.match(markup, /Conditions d'utilisation/)
  assert.match(markup, /Terms of Use/)
  assert.match(markup, /class="term-card open"/)
  assert.match(markup, /class="term-card-header"/)
  assert.doesNotMatch(markup, /<script\b|onclick=/i)
  assert.match(markup, /href="\/privacy"/)
  assert.equal((markup.match(/class="card-icon"/g) || []).length, 8)
  assert.equal((markup.match(/<svg /g) || []).length, 8)
  assert.match(source, new RegExp(TERMS_DOCUMENT_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(source, new RegExp(TERMS_QR_LIBRARY_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('Privacy React content retains bilingual policy and contact sections with React routes', async () => {
  const source = await readFile(new URL('privacy.html', legalContentDirectory), 'utf8')
  const markup = legalPageMarkup(source)
  assert.match(markup, /Politique de confidentialité|Politique de confidentialit/)
  assert.match(markup, /Privacy Policy/)
  assert.match(markup, /class="term-card-header"/)
  assert.match(markup, /mailto:raherimanantsoa\.consult@gmail\.com/)
  assert.doesNotMatch(markup, /<script\b|onclick=/i)
  assert.match(markup, /href="\/terms"/)
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
  assert.match(appSource, /if \(legalDocument\) return <LegalPage document=\{legalDocument\} \/>/)
})
