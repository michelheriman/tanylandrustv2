import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { HOME_TRANSLATIONS } from '../homeTranslations.js'

const cssUrl = new URL('./Home.css', import.meta.url)

function mediaBlock(css, query) {
  const start = css.lastIndexOf(query)
  assert.notEqual(start, -1, `missing ${query}`)
  const open = css.indexOf('{', start)
  let depth = 1
  for (let index = open + 1; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1
    if (css[index] === '}') depth -= 1
    if (depth === 0) return css.slice(open + 1, index)
  }
  assert.fail(`unclosed ${query}`)
}

test('Home mobile header reflows below 380px instead of relying on clipped overflow', async () => {
  const css = await readFile(cssUrl, 'utf8')
  const mobile = mediaBlock(css, '@media (max-width: 640px) {')
  const narrow = mediaBlock(css, '@media (max-width: 380px) {')

  assert.match(mobile, /\.home-brand\s*\{[^}]*min-width:\s*0;[^}]*flex-shrink:\s*1;/s)
  assert.match(mobile, /\.home-nav-actions\s*\{[^}]*flex:\s*0 0 auto;/s)
  assert.match(mobile, /\.nav-signin\s*\{[^}]*min-width:\s*0;[^}]*min-height:\s*44px;/s)
  assert.match(mobile, /\.language-menu summary\s*\{[^}]*min-height:\s*44px;/s)
  assert.match(mobile, /\.mobile-nav summary\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s)
  assert.match(narrow, /\.home-nav-inner\s*\{[^}]*flex-wrap:\s*wrap;/s)
  assert.match(narrow, /\.home-brand\s*\{[^}]*flex:\s*1 0 100%;/s)
  assert.match(narrow, /\.home-nav-actions\s*\{[^}]*flex:\s*1 0 100%;/s)
  assert.match(css, /\.landing-page\s*\{[^}]*overflow:\s*clip;/s)
})

test('Home mobile typography and key touch targets meet the responsive minimums', async () => {
  const css = await readFile(cssUrl, 'utf8')
  const mobile = mediaBlock(css, '@media (max-width: 640px) {')
  const tablet = mediaBlock(css, '@media (max-width: 900px) and (min-width: 641px) {')

  const readableCopy = mobile.match(/\.hero-badge,[\s\S]*?\.footer-bottom\s*\{([^}]*)\}/)
  assert.ok(readableCopy, 'mobile readable-copy rule should be present')
  assert.match(readableCopy[1], /font-size:\s*10px;/)
  for (const selector of [
    '.hero-badge', '.hero-stat > span', '.home-hero-stats > p', '.trust-items',
    '.report-card > header > span', '.report-map > span', '.report-facts > div > span',
    '.report-facts small', '.report-caption', '.gis-feature > span', '.thread-message small', '.thread-status',
    '.thread-seal', '.pricing-heading .pricing-disclaimer', '.popular-badge', '.plan-name',
    '.plan-price span', '.plan-tagline', '.price-card li', '.price-card > .button',
    '.pricing-notes p', '.footer-grid > div:first-child > p', '.footer-column h3', '.footer-bottom',
  ]) {
    assert.ok(readableCopy[0].includes(selector), `${selector} should be included in the mobile readable-copy rule`)
  }

  assert.match(mobile, /\.gis-cta\s*\{[^}]*min-height:\s*44px;/s)
  assert.match(mobile, /\.price-card > \.button\s*\{[^}]*min-height:\s*44px;/s)
  assert.match(mobile, /\.hero-buttons \.button\s*\{[^}]*min-height:\s*44px;/s)
  assert.match(tablet, /\.home-nav-links\s*\{[^}]*font-size:\s*10px;/s)
  assert.equal(HOME_TRANSLATIONS.en.nav_signin, 'Sign in')
  assert.equal(HOME_TRANSLATIONS.fr.nav_signin, 'Se connecter')
})

test('Home responsive rules cover the requested phone widths without changing desktop styles', async () => {
  const css = await readFile(cssUrl, 'utf8')
  const singleRow = mediaBlock(css, '@media (max-width: 640px) {')
  const wrapped = mediaBlock(css, '@media (max-width: 380px) {')
  const viewportWidths = [390, 375, 360, 320]

  for (const width of viewportWidths) {
    assert.ok(width <= 640, `${width}px should use the mobile control sizing`)
    assert.match(singleRow, /\.home-nav-inner\s*\{[^}]*min-width:\s*0;/s)
  }
  for (const width of viewportWidths.filter((value) => value <= 380)) {
    assert.ok(wrapped.includes('flex-wrap: wrap;'), `${width}px should use the two-row header`)
  }
  assert.equal(viewportWidths.some((width) => width > 380), true, '390px retains the compact single-row header')
  assert.match(css, /\.home-nav-inner\s*\{[^}]*min-height:\s*62px;/s, 'desktop header baseline remains unchanged')
})
