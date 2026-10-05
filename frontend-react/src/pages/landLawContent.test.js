import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { landLawCountryMarkup } from './landLawData.js'
import { blocksForTopic, countryContentBlocks, countryTopics, topicsWithSourceContent } from './landLawContent.js'
import { landLawCopy } from './landLawCopy.js'

test('includes each country section in source order with the original report structure', () => {
  assert.deepEqual(landLawCountryMarkup.map(({ id }) => id), [
    'madagascar', 'kenya', 'tanzania', 'mauritius', 'southafrica',
  ])

  for (const country of landLawCountryMarkup) {
    assert.match(country.markup, /class="country-header"/)
    assert.match(country.markup, /class="summary-card"/)
    assert.match(country.markup, /class="law-section"/)
    assert.match(country.markup, /class="key-laws"/)
    assert.match(country.markup, /class="two-col"/)
    assert.match(country.markup, /class="tags"/)
    assert.ok(country.markup.includes('data-t='), `${country.id} keeps the source translations`)
  }
})

test('keeps the page title and subtitle translations sourced from legal.html', () => {
  assert.equal(landLawCopy.en.title, 'Land Ownership Laws in Africa')
  assert.equal(landLawCopy.fr.title, 'Droit de la Propriété Foncière en Afrique')
  assert.match(landLawCopy.en.subtitle, /five African nations/)
  assert.match(landLawCopy.fr.subtitle, /cinq nations africaines/)
})

test('Main routes Land Law to its React page without a legacy iframe', () => {
  const mainSource = readFileSync(new URL('./Main.jsx', import.meta.url), 'utf8')
  assert.match(mainSource, /import LandLaw from '\.\/LandLaw\.jsx'/)
  assert.match(mainSource, /tab === 'tasks' \? <Chat lang=\{lang\} \/> : <LandLaw lang=\{lang\} \/>/)
  assert.doesNotMatch(mainSource, /<iframe|legacyUrl\(/)
})

test('each source topic button maps to existing country content and can filter it', () => {
  for (const country of landLawCountryMarkup) {
    const blocks = countryContentBlocks(country.markup)
    const sourceTopics = countryTopics(country.markup)
    const topics = topicsWithSourceContent(sourceTopics, blocks, 'en')
    assert.ok(blocks.length >= 4, `${country.id} exposes its existing content blocks`)
    assert.ok(topics.length > 0, `${country.id} exposes supported source topics`)

    for (const topic of topics) {
      const matching = blocksForTopic(blocks, topic.en)
      assert.ok(matching.length > 0, `${country.id}: ${topic.en} has a source-backed content block`)
    }
  }
})

test('does not expose a source topic as an active filter when its country section has no supporting content', () => {
  const mauritius = landLawCountryMarkup.find(({ id }) => id === 'mauritius')
  const topics = countryTopics(mauritius.markup)
  const available = topicsWithSourceContent(topics, countryContentBlocks(mauritius.markup), 'en')
  assert.ok(topics.some(({ en }) => en === 'No Capital Gains Tax'))
  assert.equal(available.some(({ en }) => en === 'No Capital Gains Tax'), false)
})

test('does not leave any other source topic without an existing matching section', () => {
  const unsupported = landLawCountryMarkup.flatMap((country) => {
    const topics = countryTopics(country.markup)
    const available = topicsWithSourceContent(topics, countryContentBlocks(country.markup), 'en')
    const availableIds = new Set(available.map(({ id }) => id))
    return topics.filter(({ id }) => !availableIds.has(id)).map(({ en }) => `${country.id}:${en}`)
  })
  assert.deepEqual(unsupported, ['mauritius:No Capital Gains Tax'])
})

test('topic selection narrows the page to matching source sections and an empty selection restores all', () => {
  const blocks = [
    { text: 'All land that is not registered is presumed to belong to the State.' },
    { text: 'The 2010 Constitution protects private property rights.' },
    { text: 'Foreign nationals may use long-term leases up to 99 years.' },
  ]

  assert.deepEqual(blocksForTopic(blocks, 'State Land Presumption'), [blocks[0]])
  assert.deepEqual(blocksForTopic(blocks, '99-Year Lease'), [blocks[2]])
  assert.equal(blocksForTopic(blocks, null), blocks)
})
