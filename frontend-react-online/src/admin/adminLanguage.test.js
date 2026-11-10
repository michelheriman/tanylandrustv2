import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { LANGUAGE_STORAGE_KEY, readLanguage, writeLanguage } from '../languageStorage.js'
import { adminText } from './adminTranslations.js'

let vite
let AdminLanguagePicker

before(async () => {
  vite = await createServer({
    configFile: './vite.config.js',
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  ;({ AdminLanguagePicker } = await vite.ssrLoadModule('/src/admin/AdminApp.jsx'))
})

after(async () => { await vite?.close() })

test('admin language selector exposes FR and EN with the current choice accessible', () => {
  const markup = renderToStaticMarkup(React.createElement(AdminLanguagePicker, { lang: 'fr', onChange() {} }))
  assert.match(markup, /<details class="admin-language-menu">/)
  assert.match(markup, /aria-label="Changer de langue, français sélectionné"/)
  assert.match(markup, /aria-label="Choisir la langue"/)
  assert.match(markup, /lang="en" aria-pressed="false">EN/)
  assert.match(markup, /lang="fr" aria-pressed="true">FR/)
})

test('admin uses the shared language preference and keeps it while navigating admin routes', async () => {
  const values = new Map()
  const storage = {
    getItem(key) { return values.get(key) ?? null },
    setItem(key, value) { values.set(key, value) },
    removeItem(key) { values.delete(key) },
  }

  assert.equal(writeLanguage('fr', storage), true)
  assert.equal(values.get(LANGUAGE_STORAGE_KEY), 'fr')
  assert.equal(readLanguage(storage), 'fr')
  assert.equal(writeLanguage('en', storage), true)
  assert.equal(readLanguage(storage), 'en')

  const source = await readFile(new URL('./AdminApp.jsx', import.meta.url), 'utf8')
  assert.match(source, /useState\(readLanguage\)/)
  assert.match(source, /writeLanguage\(lang\)/)
  assert.match(source, /<AdminPageContent[\s\S]*?lang=\{lang\}/)
  assert.match(source, /onLanguageChange=\{setLang\}/)
})

test('admin label catalog provides distinct English and French page copy', () => {
  assert.equal(adminText('en', 'Users'), 'Users')
  assert.equal(adminText('fr', 'Users'), 'Utilisateurs')
  assert.equal(adminText('fr', 'Data unavailable for the moment.'), 'Données non disponibles pour le moment.')
  assert.equal(adminText('fr', 'Map unavailable'), 'Carte indisponible')
  assert.equal(adminText('fr', 'Open status'), 'Ouverte')
})
