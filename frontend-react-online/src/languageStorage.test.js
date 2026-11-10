import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  LEGACY_LANGUAGE_STORAGE_KEY,
  readLanguage,
  writeLanguage,
} from './languageStorage.js'

function createStorage(entries = {}) {
  const values = new Map(Object.entries(entries))
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
}

test('reads supported English and French preferences from the canonical key', () => {
  assert.equal(readLanguage(createStorage({ [LANGUAGE_STORAGE_KEY]: 'fr' })), 'fr')
  assert.equal(readLanguage(createStorage({ [LANGUAGE_STORAGE_KEY]: 'en' })), 'en')
})

test('falls back to English and repairs invalid stored values', () => {
  const storage = createStorage({ [LANGUAGE_STORAGE_KEY]: 'de', [LEGACY_LANGUAGE_STORAGE_KEY]: 'es' })

  assert.equal(readLanguage(storage), DEFAULT_LANGUAGE)
  assert.equal(storage.getItem(LANGUAGE_STORAGE_KEY), DEFAULT_LANGUAGE)
  assert.equal(storage.getItem(LEGACY_LANGUAGE_STORAGE_KEY), null)
})

test('migrates a valid legacy preference when the canonical key is absent', () => {
  const storage = createStorage({ [LEGACY_LANGUAGE_STORAGE_KEY]: 'fr' })

  assert.equal(readLanguage(storage), 'fr')
  assert.equal(storage.getItem(LANGUAGE_STORAGE_KEY), 'fr')
  assert.equal(storage.getItem(LEGACY_LANGUAGE_STORAGE_KEY), null)
})

test('a valid canonical preference wins a conflict and removes the legacy key', () => {
  const storage = createStorage({ [LANGUAGE_STORAGE_KEY]: 'en', [LEGACY_LANGUAGE_STORAGE_KEY]: 'fr' })

  assert.equal(readLanguage(storage), 'en')
  assert.equal(storage.getItem(LANGUAGE_STORAGE_KEY), 'en')
  assert.equal(storage.getItem(LEGACY_LANGUAGE_STORAGE_KEY), null)
})

test('writes only supported preferences to the canonical key and removes the legacy key', () => {
  const storage = createStorage({ [LEGACY_LANGUAGE_STORAGE_KEY]: 'fr' })

  assert.equal(writeLanguage('en', storage), true)
  assert.equal(storage.getItem(LANGUAGE_STORAGE_KEY), 'en')
  assert.equal(storage.getItem(LEGACY_LANGUAGE_STORAGE_KEY), null)
  assert.equal(writeLanguage('es', storage), false)
  assert.equal(storage.getItem(LANGUAGE_STORAGE_KEY), 'en')
})

test('the saved preference is restored after a page reload', () => {
  const storage = createStorage()

  assert.equal(writeLanguage('fr', storage), true)
  assert.equal(readLanguage(storage), 'fr')
  assert.equal(writeLanguage('en', storage), true)
  assert.equal(readLanguage(storage), 'en')
})

test('Home, Main, and GeoReport share the same language storage helper', () => {
  const home = readFileSync(new URL('./pages/Home.jsx', import.meta.url), 'utf8')
  const main = readFileSync(new URL('./pages/Main.jsx', import.meta.url), 'utf8')
  const geoReport = readFileSync(new URL('./pages/GeoReport.jsx', import.meta.url), 'utf8')

  for (const source of [home, main, geoReport]) {
    assert.match(source, /import \{ readLanguage, writeLanguage \} from '\.\.\/languageStorage\.js'/)
    assert.match(source, /useState\(readLanguage\)/)
    assert.doesNotMatch(source, /tany\.home\.lang|localStorage\.getItem\('language'\)/)
  }

  assert.match(home, /writeLanguage\(lang\)/)
  assert.match(main, /writeLanguage\(lang\)/)
  assert.match(geoReport, /writeLanguage\(next\)/)
})
