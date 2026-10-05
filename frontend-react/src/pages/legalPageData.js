export const TERMS_DOCUMENT_URL = 'https://docs.google.com/document/d/1hLNnbp23wgGmEWPV6tTbKW-1cdJOZL1h/edit?usp=sharing'
export const TERMS_QR_LIBRARY_URL = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'

const termsIcons = [
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 5H6.5A1.5 1.5 0 0 0 5 6.5v13A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V6.5A1.5 1.5 0 0 0 17.5 5H16"/><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M8 12h8M8 16h6"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M5.5 16c.7-1.5 1.8-2.2 3.5-2.2s2.8.7 3.5 2.2M15 10h3M15 14h3"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 12h6M9 16h6"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v17M5 6h14M7 6l-4 8h8L7 6ZM17 6l-4 8h8l-4-8ZM8 21h8"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 21V4h12v17M17 10h3v11M9 8h4M9 12h4M9 16h4M3 21h18"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 9 9-6 9 6M5 10h14M6 10v8M10 10v8M14 10v8M18 10v8M4 19h16M3 22h18"/></svg>',
]

const privacyIcons = [
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 21V4h12v17M16 10h4v11M8 8h4M8 12h4M8 16h4M2 21h20"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.2 1-1.5 2.6-1.5-.6a8 8 0 0 1-1.5.9l-.3 1.6h-3l-.3-1.6a8 8 0 0 1-1.5-.9l-1.5.6-1.5-2.6 1.2-1a8 8 0 0 1 0-1.8l-1.2-1 1.5-2.6 1.5.6a8 8 0 0 1 1.5-.9l.3-1.6h3l.3 1.6a8 8 0 0 1 1.5.9l1.5-.6 1.5 2.6-1.2 1a8 8 0 0 1 0 1.7Z" transform="translate(-1 -1)"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m10 13 4-4M8 15l-2 2a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0M16 9l2-2a3 3 0 0 1 4 4l-4 4a3 3 0 0 1-4 0"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.4 8-8 10-4.6-2-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16v14H4zM3 3h18v4H3zM9 11v6m6-6v6"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 11V5a2 2 0 0 1 4 0v5-6a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v7c0 5-3 8-7 8h-1c-3 0-5-2-6-5l-2-4a2 2 0 0 1 4-1l1 2"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 7h10a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-6a4 4 0 0 1 4-4Z"/><path d="M8 7V4m8 3V4M7 12h10M8 16h.01M12 16h.01M16 16h.01"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 3h12v18l-6-3-6 3V3Z"/><path d="M9 8h6m-6 4h6"/></svg>',
]

const svg = (path) => `<svg class="legal-inline-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">${path}</svg>`
const arrowIcon = svg('<path d="M7 17 17 7M8 7h9v9"/>')
const documentIcon = svg('<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6"/>')
const chevronIcon = '<svg class="legal-chevron-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'

function replaceCardIcons(markup, icons) {
  let index = 0
  return markup.replace(/<div class="card-icon">[\s\S]*?<\/div>/gi, () => {
    const icon = icons[index++]
    return icon ? `<span class="card-icon" aria-hidden="true">${icon}</span>` : ''
  })
}

function replaceLegalDecorations(markup, documentType) {
  const icons = documentType === 'terms' ? termsIcons : privacyIcons
  let result = replaceCardIcons(markup, icons)
  result = result.replaceAll(String.fromCharCode(0x2713, 0x20), `${svg('<path d="m5 12 4 4L19 6"/>')} `)
  result = result.replace(/(<button class="lang-btn(?: active)?" id="btn-fr"[^>]*>)🇫🇷\s*/g, '$1<span class="language-code">FR</span> ')
    .replace(/(<button class="lang-btn(?: active)?" id="btn-en"[^>]*>)🇬🇧\s*/g, '$1<span class="language-code">EN</span> ')
    .replace(/(<span class="chevron">)▼(\s*<\/span>)/g, `$1${chevronIcon}$2`)
    .replaceAll('📄 ', `${documentIcon} `)
    .replaceAll('↗ ', `${arrowIcon} `)

  if (documentType !== 'terms') {
    const pillIcons = [
      ['🚫 ', svg('<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>')],
      ['🔒 ', svg('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>')],
      ['✋ ', svg('<path d="M7 11V5a2 2 0 0 1 4 0v5-6a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v7c0 5-3 8-7 8h-1c-3 0-5-2-6-5l-2-4a2 2 0 0 1 4-1l1 2"/>')],
      ['🏛️ ', svg('<path d="m3 9 9-6 9 6M5 10h14M6 10v8M10 10v8M14 10v8M18 10v8M4 19h16M3 22h18"/>')],
    ]
    for (const [glyph, icon] of pillIcons) result = result.replaceAll(`<span class="pill">${glyph}`, `<span class="pill">${icon}`)
  }

  const calloutIcons = [
    [String.fromCodePoint(0x26a0, 0xfe0f), svg('<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3h.01"/>')],
    [String.fromCodePoint(0x1f4cc), svg('<path d="m15 4 5 5-3 1-2 6-2-2-4 4-2-2 4-4-2-2 6-2 1-3ZM7 17l-4 4"/>')],
    [String.fromCodePoint(0x1f4cd), svg('<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>')],
    [String.fromCodePoint(0x1f512), svg('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>')],
    [String.fromCodePoint(0x1f6ab), svg('<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>')],
    [String.fromCodePoint(0x1f4a1), svg('<path d="M9 18h6m-5 3h4m-2-20a7 7 0 0 0-4 12.7c.7.5 1 1.2 1 2.3h6c0-1.1.3-1.8 1-2.3A7 7 0 0 0 12 1Z"/>')],
    [String.fromCodePoint(0x2139, 0xfe0f), svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>')],
    [String.fromCodePoint(0x1f4e7), svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>')],
    [String.fromCodePoint(0x2709, 0xfe0f), svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>')],
  ]
  for (const [glyph, icon] of calloutIcons) result = result.replaceAll(glyph, `${icon} `)
  return result
}

export function legalPageMarkup(source, documentType) {
  const body = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]
  if (!body) throw new Error('The legal document has no body content.')

  const markup = body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/\s+on(?:click|keydown|keypress|keyup)\s*=\s*(['"]).*?\1/gi, '')
    .replaceAll('src="./logo_.png"', 'src="/legacy/logo_.png"')
    .replaceAll('href="./terms.html"', 'href="/terms"')
    .replaceAll('href="./privacy.html"', 'href="/privacy"')
    .replaceAll('href="./signin.html"', 'href="/signin"')
    .replaceAll('href="./index.html"', 'href="/"')

  return replaceLegalDecorations(markup, documentType)
}
