import { useEffect, useMemo, useRef, useState } from 'react'
import termsDocument from '../legal-content/terms.html?raw'
import privacyDocument from '../legal-content/privacy.html?raw'
import { legalPageMarkup, TERMS_DOCUMENT_URL, TERMS_QR_LIBRARY_URL } from './legalPageData.js'
import { readLanguage, writeLanguage } from '../languageStorage.js'
import { applyPageMetadata } from '../seoMetadata.js'
import './LegalPage.css'

const documents = {
  terms: { source: termsDocument },
  privacy: { source: privacyDocument },
}

const qrErrorMessages = {
  en: 'The QR code could not be loaded. Use the official document link above.',
  fr: 'Le code QR n’a pas pu être chargé. Utilisez le lien vers le document officiel ci-dessus.',
}

export default function LegalPage({ document: documentType }) {
  const host = useRef(null)
  const [language, setLanguage] = useState(readLanguage)
  const [qrLoaded, setQrLoaded] = useState(false)
  const [qrError, setQrError] = useState(false)
  const current = documents[documentType] || documents.terms
  const markup = useMemo(() => legalPageMarkup(current.source, documentType), [current.source, documentType])

  useEffect(() => {
    applyPageMetadata(documentType, language)
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
        header.setAttribute('aria-expanded', String(Boolean(header.closest('.term-card')?.classList.contains('open'))))
      })
    }
  }, [documentType, language, markup])

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
      const nextLanguage = languageButton.id === 'btn-fr' ? 'fr' : 'en'
      writeLanguage(nextLanguage)
      setLanguage(nextLanguage)
      return
    }
    const header = event.target.closest('.term-card-header')
    if (header) toggleCard(header)
  }

  return <main className={`legal-page legal-page-${documentType}${qrLoaded ? ' has-qr' : ''}`} ref={host} onClick={handleClick}>
    <div dangerouslySetInnerHTML={{ __html: markup }} />
    {documentType === 'terms' && qrError && <p className="legal-qr-error" role="status">{qrErrorMessages[language]}</p>}
  </main>
}

function toggleCard(header) {
  const card = header.closest('.term-card')
  if (!card) return
  card.classList.toggle('open')
  header.setAttribute('aria-expanded', String(card.classList.contains('open')))
}
