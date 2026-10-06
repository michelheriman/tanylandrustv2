import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const css = await readFile(fileURLToPath(new URL('./GeoReport.css', import.meta.url)), 'utf8')
const page = await readFile(fileURLToPath(new URL('./GeoReport.jsx', import.meta.url)), 'utf8')

function cssBlock(source, marker) {
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `missing CSS block: ${marker}`)
  const open = source.indexOf('{', start)
  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(start, index + 1)
  }
  assert.fail(`unterminated CSS block: ${marker}`)
}

function cssRule(source, selector) {
  return cssBlock(source, `${selector} {`)
}

const tabletAndMobile = cssBlock(css, '@media (max-width: 900px)')
const mobile = cssBlock(css, '@media (max-width: 720px)')

test('Proximity lists keep internal scrolling while allowing normal scroll chaining', () => {
  const list = cssRule(css, '.georeport-proximity-list')
  const mobileList = cssRule(mobile, '.georeport-proximity-list')
  assert.match(list, /max-height:\s*210px/)
  assert.match(list, /overflow-y:\s*auto/)
  assert.doesNotMatch(list, /overscroll-behavior/)
  assert.match(mobileList, /max-height:\s*225px/)
  assert.doesNotMatch(mobileList, /overscroll-behavior/)

  assert.match(css, /\.georeport-proximity-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(cssRule(mobile, '.georeport-proximity-grid'), /grid-template-columns:\s*1fr/)
  assert.match(page, /\['hospital', t\.hospital, 'hospital'\], \['market', t\.market, 'store'\], \['transport', t\.transport, 'bus'\]/)
})

test('mobile GeoReport labels use larger type without changing desktop base sizes', () => {
  assert.match(cssRule(css, '.georeport-section-title'), /font:\s*500 10px/)
  assert.match(cssRule(css, '.georeport-stat-card > span, .georeport-stat-card > small'), /font:\s*10px/)
  assert.match(cssRule(css, '.georeport-panel > h3, .georeport-proximity-card > h3'), /font:\s*500 10px/)
  assert.match(cssRule(tabletAndMobile, '.georeport-month > span'), /font:\s*10px/)

  assert.match(cssRule(mobile, '.georeport-section-title'), /font-size:\s*11px/)
  assert.match(cssRule(mobile, '.georeport-stat-card > span, .georeport-stat-card > small'), /font-size:\s*11px/)
  assert.match(cssRule(mobile, '.georeport-panel > h3, .georeport-proximity-card > h3'), /font-size:\s*11px/)
  assert.match(cssRule(mobile, '.georeport-month > span'), /font-size:\s*10px/)
  assert.match(cssRule(mobile, '.georeport-slope-column > span'), /font-size:\s*10px/)
  assert.match(cssRule(mobile, '.georeport-soil-card h3'), /font-size:\s*11px/)
  assert.match(cssRule(mobile, '.georeport-soil-card > small'), /font-size:\s*10px/)
})

test('requested mobile viewports remain in the stacked, width-constrained layout and Leaflet styles are unchanged', () => {
  const viewports = [[390, 844], [375, 812], [360, 800], [320, 568]]
  assert.ok(viewports.every(([width]) => width <= 720))
  assert.match(cssRule(mobile, '.georeport-proximity-grid'), /grid-template-columns:\s*1fr/)
  assert.match(cssRule(mobile, '.georeport-location-grid'), /grid-template-columns:\s*1fr/)
  assert.match(cssRule(mobile, '.georeport-map'), /height:\s*330px/)
  assert.match(cssRule(css, '.georeport-location-grid'), /minmax\(0,\s*2fr\)/)
  assert.match(page, /L\.map\(host\.current, \{ scrollWheelZoom: false \}\)/)
  assert.doesNotMatch(css, /touch-action\s*:/)
})

