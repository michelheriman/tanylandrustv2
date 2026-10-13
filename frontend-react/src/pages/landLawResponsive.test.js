import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync(new URL('./LandLaw.css', import.meta.url), 'utf8')
const jsx = readFileSync(new URL('./LandLaw.jsx', import.meta.url), 'utf8')
const mainCss = readFileSync(new URL('./Main.css', import.meta.url), 'utf8')

function matchingMediaBlocks(source, maxWidth) {
  const query = new RegExp(`@media\\s*\\(max-width:\\s*${maxWidth}px\\)\\s*\\{`, 'g')
  const matches = [...source.matchAll(query)]
  assert.ok(matches.length, `expected a ${maxWidth}px media query`)
  return matches.map(({ index: start }) => {
    const open = source.indexOf('{', start)
    let depth = 0

    for (let index = open; index < source.length; index += 1) {
      if (source[index] === '{') depth += 1
      if (source[index] === '}') {
        depth -= 1
        if (depth === 0) return source.slice(open + 1, index)
      }
    }

    throw new Error(`unclosed ${maxWidth}px media query`)
  })
}

function matchingMediaBlock(source, maxWidth) {
  return matchingMediaBlocks(source, maxWidth).at(-1)
}

function declarationsFor(block, selector) {
  const declarations = {}
  const rules = /([^{}]+)\{([^{}]*)\}/g
  let match

  while ((match = rules.exec(block))) {
    const selectors = match[1].trim().split(',').map((item) => item.trim())
    if (!selectors.includes(selector)) continue
    for (const declaration of match[2].split(';')) {
      const separator = declaration.indexOf(':')
      if (separator < 0) continue
      declarations[declaration.slice(0, separator).trim()] = declaration.slice(separator + 1).trim()
    }
  }

  return declarations
}

const mobile = matchingMediaBlock(css, 700)
const narrowMobile = matchingMediaBlock(css, 440)

test('all requested phone viewports use the mobile and narrow-screen layout rules', () => {
  for (const [width, height] of [[390, 844], [375, 812], [360, 800], [320, 568]]) {
    assert.ok(width <= 700 && height > 0)
    assert.ok(width <= 440)
  }

  assert.match(declarationsFor(narrowMobile, '.land-law-country-tabs')['grid-template-columns'], /repeat\(3,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(jsx, /countries\.map\(\(country, index\)/)
  assert.equal((jsx.match(/id: '(?:madagascar|kenya|tanzania|mauritius|southafrica)'/g) ?? []).length, 5)
})

test('mobile legal text uses readable minimum sizes and wraps within its content width', () => {
  const expectedSizes = [
    ['.land-law-title-card p', '11px'],
    ['.land-law-country-content .country-subtitle', '10px'],
    ['.land-law-country-content .summary-card p', '11px'],
    ['.land-law-country-content .law-section h3', '12px'],
    ['.land-law-country-content .law-section p', '11px'],
    ['.land-law-country-content .key-laws', '10px'],
    ['.land-law-country-content .key-laws th', '10px'],
    ['.land-law-country-content .key-laws td', '10px'],
    ['.land-law-country-content .info-box h4', '11px'],
    ['.land-law-country-content .info-box ul', '10px'],
    ['.land-law-country-content .alert', '10px'],
    ['.land-law-disclaimer', '10px'],
    ['.land-law-footer', '10px'],
  ]

  for (const [selector, size] of expectedSizes) {
    assert.equal(declarationsFor(mobile, selector)['font-size'], size, selector)
  }

  const table = declarationsFor(mobile, '.land-law-country-content .key-laws')
  assert.equal(table.width, '100%')
  assert.equal(table['max-width'], '100%')
  assert.equal(table['min-width'], '0')
  assert.equal(table['table-layout'], 'fixed')
  assert.equal(declarationsFor(mobile, '.land-law-country-content .key-laws td')['overflow-wrap'], 'anywhere')
  assert.equal(declarationsFor(mobile, '.land-law-country-content .law-section')['overflow-x'], 'visible')
  assert.doesNotMatch(mobile, /overflow-x:\s*hidden|overflow-y:\s*hidden|(?:^|[;\s])height:\s*\d/)
})

test('country and topic controls have mobile touch targets and can wrap labels', () => {
  for (const selector of ['.land-law-country-tab', '.land-law-page .land-law-country-tab']) {
    const declarations = declarationsFor(mobile, selector)
    assert.equal(declarations['min-height'], '44px', selector)
    assert.equal(declarations['white-space'], 'normal', selector)
    assert.equal(declarations['overflow-wrap'], 'anywhere', selector)
  }

  for (const selector of ['.land-law-topic', '.land-law-page .land-law-topic']) {
    const declarations = declarationsFor(mobile, selector)
    assert.equal(declarations['min-height'], '44px', selector)
    assert.equal(declarations['white-space'], 'normal', selector)
    assert.equal(declarations['flex'], '1 1 132px', selector)
    assert.equal(declarations['overflow-wrap'], 'anywhere', selector)
  }
})

test('mobile layout remains naturally scrollable and leaves room for fixed navigation', () => {
  const mobileBlocks = matchingMediaBlocks(css, 700)
  const pagePaddingExists = mobileBlocks.some((block) => declarationsFor(block, '.land-law-page').padding === '8px 11px 72px')
  assert.equal(pagePaddingExists, true)
  assert.doesNotMatch(mobile, /(?:^|[;\s])height:\s*\d|overflow(?:-y)?:\s*hidden/)
  assert.match(mainCss, /\.main-mobile-nav\s*\{[^}]*position:\s*fixed;[^}]*min-height:\s*62px;/s)
  assert.match(mainCss, /\.main-content\s*\{\s*padding:\s*10px 10px 88px;/)
})

test('country tabs and topic controls retain their accessible React behavior', () => {
  assert.match(jsx, /role="tab"/)
  assert.match(jsx, /aria-selected=\{active\}/)
  assert.match(jsx, /tabIndex=\{active \? 0 : -1\}/)
  assert.match(jsx, /event\.key === 'ArrowRight'/)
  assert.match(jsx, /event\.key === 'ArrowLeft'/)
  assert.match(jsx, /aria-pressed=\{activeTopicId === topic\.id\}/)
  assert.match(mainCss, /:focus-visible\s*\{\s*outline:/)
})

test('responsive overrides are scoped to mobile, leaving desktop declarations intact', () => {
  assert.match(css, /\.land-law-country-tab\s*\{\s*min-height:\s*27px;/)
  assert.match(css, /\.land-law-topic\s*\{[^}]*min-height:\s*18px;/s)
  assert.equal(declarationsFor(mobile, '.land-law-country-tab')['min-height'], '44px')
  assert.equal(declarationsFor(mobile, '.land-law-topic')['min-height'], '44px')
})
