import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { HOME_TRANSLATIONS } from './homeTranslations.js'

const homeSourceUrl = new URL('./pages/Home.jsx', import.meta.url)

test('Home translates the peak label and accessible names in English and French', async () => {
  const source = await readFile(homeSourceUrl, 'utf8')

  assert.equal(HOME_TRANSLATIONS.en.peak_label, 'Peak')
  assert.equal(HOME_TRANSLATIONS.fr.peak_label, 'Pic')
  assert.equal(HOME_TRANSLATIONS.en.stats_aria, 'Tany in numbers')
  assert.equal(HOME_TRANSLATIONS.fr.stats_aria, 'Tany en chiffres')
  assert.equal(HOME_TRANSLATIONS.fr.brand_home_aria, 'Tany Landtrust, accueil')
  assert.equal(HOME_TRANSLATIONS.en.brand_home_aria, 'Tany Landtrust, home')
  assert.equal(HOME_TRANSLATIONS.fr.language_selected_aria, 'Changer de langue, français sélectionné')
  assert.equal(HOME_TRANSLATIONS.en.language_selected_aria, 'Change language, English selected')
  assert.equal(HOME_TRANSLATIONS.fr.illustrative_map_aria, 'Carte topographique illustrative d’une parcelle')
  assert.equal(HOME_TRANSLATIONS.en.illustrative_map_aria, 'Illustrative parcel topography map')
  assert.match(source, /aria-label=\{t\('stats_aria'\)\}/)
  assert.match(source, /aria-label=\{t\('main_navigation_aria'\)\}/)
  assert.match(source, /aria-label=\{t\('mobile_navigation_aria'\)\}/)
  assert.match(source, /aria-label=\{t\('platform_principles_aria'\)\}/)
  assert.match(source, /\{t\('peak_label'\)\} 1242 m/)
})

test('Home translations preserve numeric statistics and existing bilingual copy', async () => {
  const source = await readFile(homeSourceUrl, 'utf8')

  assert.match(source, /const numbers = \[12400, 98, 34\]/)
  assert.match(source, /useState\(numbers\)/)
  assert.doesNotMatch(source, /useState\(\[12400, 100, 24\]\)/)
  assert.match(source, /\{counts\[index\]\.toLocaleString/)
  assert.equal(HOME_TRANSLATIONS.en.stat0_label, 'Parcels listed')
  assert.equal(HOME_TRANSLATIONS.fr.stat0_label, 'Parcelles enregistrées')
  assert.equal(HOME_TRANSLATIONS.en.gis_d1_label, 'Avg. Slope')
  assert.equal(HOME_TRANSLATIONS.fr.gis_d1_label, 'Pente moy.')
})
