import { useEffect, useMemo, useRef, useState } from 'react'
import termsDocument from '../legal-content/terms.html?raw'
import privacyDocument from '../legal-content/privacy.html?raw'
import { legalPageMarkup, TERMS_DOCUMENT_URL, TERMS_QR_LIBRARY_URL } from './legalPageData.js'
import './LegalPage.css'

const documents = {
  terms: { source: termsDocument, title: 'Terms of Use | Tany LandTrust' },
  privacy: { source: privacyDocument, title: 'Privacy Policy | Tany LandTrust' },
}

export default function LegalPage({ document: documentType }) {
  const host = useRef(null)
  const [language, setLanguage] = useState('fr')
  const [qrLoaded, setQrLoaded] = useState(false)
  const [qrError, setQrError] = useState(false)
  const current = documents[documentType] || documents.terms
  const markup = useMemo(() => legalPageMarkup(current.source, documentType), [current.source, documentType])

  useEffect(() => {
    document.title = current.title
    const previousLanguage = document.documentElement.lang
    document.documentElement.lang = language
    const container = host.current
    if (container) {
      container.querySelectorAll('.lang-fr').forEach((element) => element.classList.toggle('visible', language === 'fr'))
      container.querySelectorAll('.lang-en').forEach((element) => element.classList.toggle('visible', language === 'en'))
      container.querySelectorAll('.lang-btn').forEach((button) => {
        const active = button.id === `btn-${language}`
        button.classList.toggle('active', active)
        button.setAttribute('aria-pressed', String(active))
      })
      container.querySelectorAll('.term-card-header').forEach((header) => {
        header.setAttribute('role', 'button')
        header.setAttribute('tabindex', '0')
        header.setAttribute('aria-expanded', String(Boolean(header.closest('.term-card')?.classList.contains('open'))))
      })
    }
    return () => { document.documentElement.lang = previousLanguage }
  }, [current.title, language, markup])

  useEffect(() => {
    if (documentType !== 'terms') return undefined
    let active = true

    function renderQrCode() {
      if (!active) return
      const target = host.current?.querySelector('#qrcode')
      const QrCode = window.QRCode
      if (!target || !QrCode) {
        setQrError(true)
        return
      }
      target.replaceChildren()
      new QrCode(target, {
        text: TERMS_DOCUMENT_URL,
        width: 120,
        height: 120,
        colorDark: '#047857',
        colorLight: '#ffffff',
        correctLevel: QrCode.CorrectLevel.M,
      })
      setQrError(false)
      setQrLoaded(true)
    }

    if (window.QRCode) {
      renderQrCode()
      return () => { active = false }
    }

    let script = document.querySelector('script[data-tany-qrcode]')
    const ownsScript = !script
    if (!script) {
      script = document.createElement('script')
      script.src = TERMS_QR_LIBRARY_URL
      script.async = true
      script.dataset.tanyQrcode = 'true'
      document.head.append(script)
    }
    const onLoad = () => renderQrCode()
    const onError = () => { if (active) setQrError(true) }
    script.addEventListener('load', onLoad)
    script.addEventListener('error', onError)
    if (!ownsScript && window.QRCode) renderQrCode()
    return () => {
      active = false
      script.removeEventListener('load', onLoad)
      script.removeEventListener('error', onError)
    }
  }, [documentType, markup])

  function handleClick(event) {
    const languageButton = event.target.closest('.lang-btn')
    if (languageButton?.id === 'btn-fr' || languageButton?.id === 'btn-en') {
      setLanguage(languageButton.id === 'btn-fr' ? 'fr' : 'en')
      return
    }
    const header = event.target.closest('.term-card-header')
    if (header) toggleCard(header)
  }

  function handleKeyDown(event) {
    const header = event.target.closest('.term-card-header')
    if (!header || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    toggleCard(header)
  }

  return <main className={`legal-page legal-page-${documentType}${qrLoaded ? ' has-qr' : ''}`} ref={host} onClick={handleClick} onKeyDown={handleKeyDown}>
    <div dangerouslySetInnerHTML={{ __html: markup }} />
    {documentType === 'terms' && qrError && <p className="legal-qr-error" role="status">The QR code could not be loaded. Use the official document link above.</p>}
  </main>
}

function toggleCard(header) {
  const card = header.closest('.term-card')
  if (!card) return
  card.classList.toggle('open')
  header.setAttribute('aria-expanded', String(card.classList.contains('open')))
}
