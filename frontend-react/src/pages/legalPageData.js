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

function replaceTermsIcons(markup) {
  let index = 0
  return markup.replace(/<div class="card-icon">[\s\S]*?<\/div>/gi, () => {
    const icon = termsIcons[index++]
    return icon ? `<span class="card-icon" aria-hidden="true">${icon}</span>` : ''
  })
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

  return documentType === 'terms' ? replaceTermsIcons(markup) : markup
}
