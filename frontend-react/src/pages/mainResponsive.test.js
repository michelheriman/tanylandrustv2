import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const mainSource = await readFile(fileURLToPath(new URL('./Main.jsx', import.meta.url)), 'utf8')
const marketplaceSource = await readFile(fileURLToPath(new URL('./Marketplace.jsx', import.meta.url)), 'utf8')
const kmlImportSource = await readFile(fileURLToPath(new URL('./KmlImport.jsx', import.meta.url)), 'utf8')
const mainCss = await readFile(fileURLToPath(new URL('./Main.css', import.meta.url)), 'utf8')
const marketplaceCss = await readFile(fileURLToPath(new URL('./Marketplace.css', import.meta.url)), 'utf8')
const globalCss = await readFile(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8')

function block(source, marker) {
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `expected CSS block: ${marker}`)
  const open = source.indexOf('{', start)
  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(start, index + 1)
  }
  assert.fail(`unterminated CSS block: ${marker}`)
}

function rule(source, selector) {
  const marker = `${selector} {`
  return block(source, marker)
}

const mobileMain = block(mainCss, '@media (max-width: 700px)')
const mobileMarketplace = block(marketplaceCss, '@media (max-width: 767px)')

test('Main renders Marketplace as the mobile Main tab and places its sidebar before the map', () => {
  assert.match(mainSource, /tab === 'crops' \? ' main-content-marketplace' : ''/)
  assert.match(mainSource, /tab === 'crops' \? <Marketplace lang=\{lang\} \/>/)
  assert.doesNotMatch(mainSource, /main-content-dashboard/)

  const sidebarPosition = marketplaceSource.indexOf('<aside className="market-react-sidebar"')
  const mapPosition = marketplaceSource.indexOf('<div className="market-react-map"')
  assert.ok(sidebarPosition >= 0 && mapPosition > sidebarPosition, 'the filter/sidebar DOM must precede the map DOM')
  assert.match(marketplaceSource, /filterLabels\.area/)
})

test('mobile Marketplace uses a natural document flow instead of fixed-height clipping', () => {
  const content = rule(mobileMarketplace, '.main-content.main-content-marketplace')
  assert.match(content, /height:\s*auto/)
  assert.match(content, /min-height:\s*calc\(100dvh\s*-\s*58px\)/)
  assert.match(content, /overflow:\s*visible/)
  assert.match(content, /padding:\s*10px\s+10px\s+calc\(62px\s*\+\s*env\(safe-area-inset-bottom\)\s*\+\s*24px\)/)
  assert.doesNotMatch(content, /max-height|overflow-y:\s*(hidden|auto)/)

  const section = rule(mobileMarketplace, '.main-content-marketplace > .main-market-section')
  assert.match(section, /height:\s*auto/)
  assert.match(section, /min-height:\s*0/)
  assert.match(section, /grid-template-rows:\s*57px\s+auto/)
  assert.doesNotMatch(section, /minmax\(720px|height:\s*100%/)

  const workspace = rule(mobileMarketplace, '.market-react-workspace')
  assert.match(workspace, /height:\s*auto/)
  assert.match(workspace, /min-height:\s*0/)
  assert.match(workspace, /grid-template-rows:\s*35px\s+auto\s+minmax\(350px,\s*58svh\)/)
  assert.match(workspace, /overflow:\s*visible/)
  assert.doesNotMatch(workspace, /min-height:\s*720px|44%|56%/)
})

test('expanded filters are not clipped and the parcel list alone keeps its bounded scroll', () => {
  const sidebar = rule(mobileMarketplace, '.market-react-sidebar')
  assert.match(sidebar, /height:\s*auto/)
  assert.match(sidebar, /min-height:\s*0/)
  assert.match(sidebar, /max-height:\s*none/)
  assert.match(sidebar, /overflow:\s*visible/)

  const filterPanel = rule(marketplaceCss, '.market-react-filter-panel')
  const filterFields = rule(marketplaceCss, '.market-react-filter-fields')
  assert.match(filterPanel, /flex:\s*0\s+0\s+auto/)
  assert.doesNotMatch(filterPanel, /height|max-height|overflow:\s*hidden/)
  assert.doesNotMatch(filterFields, /height|max-height|overflow:\s*hidden/)

  const list = rule(mobileMarketplace, '.market-react-list')
  assert.match(list, /max-height:\s*32svh/)
  assert.match(rule(marketplaceCss, '.market-react-list'), /overflow:\s*auto/)
})

test('the document can grow, bottom navigation clearance remains, and the map retains usable height', () => {
  const body = rule(globalCss, 'body')
  const root = rule(globalCss, '#root')
  assert.doesNotMatch(body, /\n\s*height:\s*100|overflow(?:-y)?:\s*hidden/)
  assert.doesNotMatch(root, /\n\s*height:\s*100|overflow(?:-y)?:\s*hidden/)

  const nav = rule(mobileMain, '.main-mobile-nav')
  assert.match(nav, /position:\s*fixed/)
  assert.match(nav, /bottom:\s*0/)
  assert.match(nav, /min-height:\s*62px/)

  const map = rule(mobileMarketplace, '.market-react-map')
  assert.match(map, /min-height:\s*350px/)
  assert.doesNotMatch(map, /touch-action/)
})

test('all requested mobile widths use the natural-flow breakpoint and desktop rules remain separate', () => {
  const viewports = [[390, 844], [375, 812], [360, 800], [320, 568]]
  assert.ok(viewports.every(([width]) => width <= 767))
  for (const [width, height] of viewports) {
    assert.ok(width >= 320, `the layout must remain within the supported ${width}px viewport`)
    assert.ok(height - 58 > 0, `natural flow has positive height at ${width}x${height}`)
  }

  assert.match(marketplaceCss, /@media \(min-width: 1024px\)/)
  assert.match(marketplaceCss, /@media \(max-width: 767px\)/)
  assert.match(mobileMain, /\.main-mobile-nav \{[^}]*position: fixed/)
})

test('mobile KML controls are readable, long names wrap, and the form remains before the map', () => {
  for (const width of [390, 375, 360, 320]) assert.ok(width <= 700, `${width}px uses the mobile KML rules`)
  assert.match(mobileMain, /\.main-kml-dropzone span,\s*\.main-kml-dropzone button,\s*\.main-kml-file-info,\s*\.main-kml-file-info small,\s*\.main-kml-progress\s*\{\s*font-size:\s*10px;/)
  const browseButton = rule(mobileMain, '.main-kml-dropzone button')
  assert.match(browseButton, /min-height:\s*44px/)

  const filename = rule(mobileMain, '.main-kml-file-info strong')
  assert.match(filename, /overflow-wrap:\s*anywhere/)
  assert.match(filename, /white-space:\s*normal/)
  assert.match(kmlImportSource, /<strong title=\{file\.name\}>\{file\.name\}<\/strong>/)

  const importer = mainSource.indexOf('<KmlImport layout="manager-column"')
  const map = mainSource.indexOf('<div className="main-map-wrap">', importer)
  assert.ok(importer >= 0 && map > importer, 'KML form must remain before the map in Main')
  assert.match(rule(mobileMain, '.main-map-wrap, .main-map-canvas'), /min-height:\s*49svh/)
  assert.match(rule(mobileMain, '.main-mobile-nav'), /position:\s*fixed/)

  assert.match(rule(mainCss, '.main-kml-dropzone button'), /font-size:\s*9px/)
  assert.match(rule(mainCss, '.main-kml-file-info'), /font-size:\s*9px/)
})
