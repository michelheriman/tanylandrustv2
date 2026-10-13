import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { MAIN_LABELS, PARCEL_STATUS_OPTIONS, parcelStatusLabel } from './mainLabels.js'

const main = readFileSync(new URL('./Main.jsx', import.meta.url), 'utf8')

test('Main filter and language selector labels follow the active language', () => {
  assert.equal(MAIN_LABELS.filter.fr, 'Filtrer :')
  assert.equal(MAIN_LABELS.filter.en, 'Filter:')
  assert.equal(MAIN_LABELS.languageMenu.fr, 'Changer de langue, français sélectionné')
  assert.equal(MAIN_LABELS.languageMenu.en, 'Change language, English selected')
  assert.equal(MAIN_LABELS.switchLanguage.fr, 'Changer de langue')
  assert.equal(MAIN_LABELS.switchLanguage.en, 'Switch language')
  assert.match(main, /MAIN_LABELS\.filter\[lang\]/)
  assert.match(main, /MAIN_LABELS\.languageMenu\[lang\]/)
  assert.match(main, /<span>\{lang\.toUpperCase\(\)\}<\/span>/)
})

test('parcel status options display translated labels while keeping backend values stable', () => {
  assert.deepEqual(PARCEL_STATUS_OPTIONS.sell_category.map(({ value }) => value), ['to_sell', 'vendu', 'autre', 'na'])
  assert.deepEqual(PARCEL_STATUS_OPTIONS.status_category.map(({ value }) => value), ['titre', 'titre_borne', 'kt', 'na'])
  assert.equal(parcelStatusLabel('sell_category', 'to_sell', 'fr'), 'À vendre')
  assert.equal(parcelStatusLabel('sell_category', 'to_sell', 'en'), 'For sale')
  assert.equal(parcelStatusLabel('status_category', 'titre_borne', 'fr'), 'Titre et borne')
  assert.equal(parcelStatusLabel('status_category', 'titre_borne', 'en'), 'Property title')
  assert.equal(parcelStatusLabel('status_category', 'unknown-value', 'fr'), 'unknown-value')
  assert.match(main, /value=\{option\.value\}/)
  assert.match(main, /\{option\[lang\]\}/)
})

test('Main keeps the existing backend status keys and payload fields', () => {
  assert.match(main, /name="sell_category"/)
  assert.match(main, /name="status_category"/)
  assert.match(main, /value=\{addForm\.sell_category\}/)
  assert.match(main, /value=\{addForm\.status_category\}/)
  assert.match(main, /saveParcelFields\(request, row\.id, changedFields, editDraft\)/)
  assert.match(main, /createParcel\(request, addForm, draftGeometry, user\?\.email\)/)
})
