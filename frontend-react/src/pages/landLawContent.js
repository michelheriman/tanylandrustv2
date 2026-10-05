const topicStopWords = new Set(['a', 'an', 'and', 'by', 'for', 'in', 'of', 'on', 'the', 'to'])

function decodeHtmlText(value) {
  return String(value ?? '')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&ldquo;/gi, '“')
    .replace(/&rdquo;/gi, '”')
    .replace(/&lsquo;/gi, '‘')
    .replace(/&rsquo;/gi, '’')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

export function plainTextFromMarkup(markup) {
  return decodeHtmlText(String(markup ?? '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

export function countryContentBlocks(markup) {
  const countryStart = String(markup ?? '').indexOf('>') + 1
  const countryEnd = String(markup ?? '').lastIndexOf('</section>')
  if (countryStart <= 0 || countryEnd < countryStart) return []

  const body = markup.slice(countryStart, countryEnd)
  const tags = /<div\b[^>]*>|<\/div\s*>/gi
  const blocks = []
  let depth = 0
  let start = -1
  let match

  while ((match = tags.exec(body))) {
    if (/^<div\b/i.test(match[0])) {
      if (depth === 0) start = match.index
      depth += 1
      continue
    }

    depth -= 1
    if (depth !== 0 || start < 0) continue
    const html = body.slice(start, tags.lastIndex)
    const className = html.match(/^<div\b[^>]*\bclass="([^"]+)"/i)?.[1] ?? ''
    if (['summary-card', 'law-section', 'two-col', 'alert'].some((name) => className.split(/\s+/).includes(name))) {
      blocks.push({ html, text: plainTextFromMarkup(html), className })
    }
    start = -1
  }

  return blocks
}

export function countryTopics(markup) {
  const topics = []
  const tagPattern = /<span\b([^>]*\bclass="tag"[^>]*)>([\s\S]*?)<\/span>/gi
  let match
  while ((match = tagPattern.exec(String(markup ?? '')))) {
    const translations = match[1].match(/\bdata-t='([^']*)'/i)?.[1]
    let label = plainTextFromMarkup(match[2])
    let frenchLabel = label
    if (translations) {
      try {
        const parsed = JSON.parse(translations)
        label = parsed.en ?? label
        frenchLabel = parsed.fr ?? label
      } catch { /* Keep the source label when a translation entry is malformed. */ }
    }
    topics.push({ id: String(topics.length), en: decodeHtmlText(label), fr: decodeHtmlText(frenchLabel) })
  }
  return topics
}

function topicTerms(value) {
  return [...new Set(String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !topicStopWords.has(term)))]
}

function termsMatch(left, right) {
  if (left === right) return true
  return Math.min(left.length, right.length) >= 5 && (left.startsWith(right) || right.startsWith(left))
}

export function topicRelevance(topic, content) {
  const terms = topicTerms(topic)
  if (!terms.length) return 0
  const contentTerms = topicTerms(content)
  const matched = terms.filter((term) => contentTerms.some((candidate) => termsMatch(term, candidate)))
  return matched.length / terms.length
}

export function blocksForTopic(blocks, topic) {
  if (!topic) return blocks
  return blocks.filter((block) => topicRelevance(topic, block.text) >= 0.5)
}

export function topicsWithSourceContent(topics, blocks, lang = 'en') {
  return topics
    .map((topic) => ({ ...topic, matches: blocksForTopic(blocks, topic[lang]) }))
    .filter((topic) => topic.matches.length > 0)
}
