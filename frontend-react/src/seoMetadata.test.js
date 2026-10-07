import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { applyPageMetadata, getPageMetadata } from './seoMetadata.js'

function mockDocument() {
  const elements = []
  return {
    documentElement: { lang: '' },
    title: '',
    head: {
      appendChild(element) { elements.push(element) },
    },
    createElement(tagName) {
      return {
        tagName,
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = String(value) },
        getAttribute(name) { return this.attributes[name] ?? null },
        remove() { const index = elements.indexOf(this); if (index >= 0) elements.splice(index, 1) },
      }
    },
    querySelector(selector) {
      const name = selector.match(/^meta\[name="([^"]+)"\]$/)?.[1]
      return elements.find((element) => element.getAttribute('name') === name) ?? null
    },
  }
}

test('SEO titles and descriptions are localized for public and authentication pages', () => {
  assert.equal(getPageMetadata('home', 'fr').title, 'Tany | Landtrust — Gestion et valorisation foncière')
  assert.equal(getPageMetadata('home', 'en').title, 'Tany | Landtrust — Land Management and Marketplace')
  assert.match(getPageMetadata('home', 'fr').description, /parcelles|marketplace/i)
  assert.match(getPageMetadata('home', 'en').description, /parcel|marketplace/i)
  assert.equal(getPageMetadata('signIn', 'fr').title, 'Connexion | Tany LandTrust')
  assert.equal(getPageMetadata('signIn', 'en').title, 'Sign in | Tany LandTrust')
  assert.equal(getPageMetadata('signUp', 'fr').title, 'Inscription | Tany LandTrust')
  assert.equal(getPageMetadata('signUp', 'en').title, 'Sign up | Tany LandTrust')
  assert.equal(getPageMetadata('terms', 'fr').title, 'Conditions d’utilisation | Tany Landtrust')
  assert.equal(getPageMetadata('terms', 'en').title, 'Terms of Use | Tany Landtrust')
  assert.equal(getPageMetadata('privacy', 'fr').title, 'Politique de confidentialité | Tany Landtrust')
  assert.equal(getPageMetadata('privacy', 'en').title, 'Privacy Policy | Tany Landtrust')

  for (const page of ['home', 'signIn', 'signUp', 'terms', 'privacy']) {
    assert.ok(getPageMetadata(page, 'fr').description.length > 30, `${page} has a French description`)
    assert.ok(getPageMetadata(page, 'en').description.length > 30, `${page} has an English description`)
    assert.notEqual(getPageMetadata(page, 'fr').description, getPageMetadata(page, 'en').description)
  }
})

test('page metadata sets language and descriptions, adds noindex privately, and removes it publicly', () => {
  const document = mockDocument()

  applyPageMetadata('main', 'fr', { document })
  assert.equal(document.documentElement.lang, 'fr')
  assert.equal(document.querySelector('meta[name="description"]').getAttribute('content'), getPageMetadata('main', 'fr').description)
  assert.equal(document.querySelector('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow')

  applyPageMetadata('signUp', 'en', { document })
  assert.equal(document.documentElement.lang, 'en')
  assert.equal(document.title, 'Sign up | Tany LandTrust')
  assert.equal(document.querySelector('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow')

  applyPageMetadata('terms', 'fr', { document })
  assert.equal(document.documentElement.lang, 'fr')
  assert.equal(document.title, 'Conditions d’utilisation | Tany Landtrust')
  assert.equal(document.querySelector('meta[name="robots"]'), null)

  applyPageMetadata('privacy', 'en', { document })
  assert.equal(document.documentElement.lang, 'en')
  assert.equal(document.title, 'Privacy Policy | Tany Landtrust')
  assert.equal(document.querySelector('meta[name="robots"]'), null)

  for (const page of ['signIn', 'signUp', 'main', 'geoReport', 'notFound']) {
    const metadata = getPageMetadata(page, 'en')
    assert.equal(metadata.indexable, false, `${page} is not indexable`)
    assert.equal(metadata.robots, 'noindex, nofollow')
  }
  for (const page of ['home', 'terms', 'privacy']) {
    assert.equal(getPageMetadata(page, 'fr').indexable, true, `${page} remains indexable`)
    assert.equal(getPageMetadata(page, 'fr').robots, null)
  }
})

test('all page components use the shared metadata helper and public shell declares its favicon', async () => {
  const [app, home, main, geoReport, legalPage, notFound, index, homeCss] = await Promise.all([
    readFile(new URL('./App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./pages/Home.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./pages/Main.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./pages/GeoReport.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./pages/LegalPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('./pages/NotFound.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('./App.css', import.meta.url), 'utf8'),
  ])

  assert.match(app, /applyPageMetadata\(metadataPage, language\)/)
  assert.match(app, /isSignUp \? 'signUp' : 'signIn'/)
  assert.match(home, /applyPageMetadata\('home', lang\)/)
  assert.match(main, /applyPageMetadata\('main', lang/)
  assert.match(geoReport, /applyPageMetadata\('geoReport', lang/)
  assert.match(legalPage, /applyPageMetadata\(documentType, language\)/)
  assert.match(notFound, /href="\/"/)
  assert.match(index, /<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg"/)
  assert.match(home, /\['footer_tos', '\/terms'\].*\['footer_privacy', '\/privacy'\]/)
  assert.match(homeCss, /status-home-link:focus-visible/)
})

test('NotFound metadata is localized and non-indexable', () => {
  assert.equal(getPageMetadata('notFound', 'fr').title, 'Page introuvable | Tany Landtrust')
  assert.equal(getPageMetadata('notFound', 'en').title, 'Page not found | Tany Landtrust')
  assert.equal(getPageMetadata('notFound', 'fr').robots, 'noindex, nofollow')
  assert.equal(getPageMetadata('notFound', 'en').indexable, false)
})
