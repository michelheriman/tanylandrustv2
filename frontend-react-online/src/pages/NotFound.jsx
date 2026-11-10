import { NOT_FOUND_COPY } from '../seoMetadata.js'

export default function NotFound({ lang }) {
  const copy = NOT_FOUND_COPY[lang === 'fr' ? 'fr' : 'en']

  return (
    <main className="status-screen">
      <section className="status-panel" aria-labelledby="not-found-title">
        <p className="eyebrow">Tany | LandTrust</p>
        <h1 id="not-found-title">{copy.heading}</h1>
        <p>{lang === 'fr' ? 'La page que vous cherchez n’existe pas ou a été déplacée.' : 'The page you are looking for does not exist or has moved.'}</p>
        <a className="status-home-link" href="/">{copy.home}</a>
      </section>
    </main>
  )
}
