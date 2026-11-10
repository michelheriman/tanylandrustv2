import { useMemo, useState } from 'react'
import { landLawCountryMarkup } from './landLawData.js'
import { countryTopics, topicsWithSourceContent } from './landLawContent.js'
import { landLawCopy } from './landLawCopy.js'
import './LandLaw.css'

const countries = [
  { id: 'madagascar', en: 'Madagascar', fr: 'Madagascar' },
  { id: 'kenya', en: 'Kenya', fr: 'Kenya' },
  { id: 'tanzania', en: 'Tanzania', fr: 'Tanzanie' },
  { id: 'mauritius', en: 'Mauritius', fr: 'Maurice' },
  { id: 'southafrica', en: 'South Africa', fr: 'Afrique du Sud' },
]

function translateMarkup(markup, lang, activeTopicId) {
  const documentView = new DOMParser().parseFromString(markup, 'text/html')
  const country = documentView.querySelector('.country')
  if (!country) return { html: '', topics: [] }

  country.querySelectorAll('[data-t]').forEach((element) => {
    try {
      const translations = JSON.parse(element.getAttribute('data-t'))
      if (typeof translations[lang] === 'string') element.textContent = translations[lang]
    } catch { /* Leave the source copy visible if an optional translation is malformed. */ }
  })

  const topicList = countryTopics(markup)
  const header = Array.from(country.children).find((element) => element.classList.contains('country-header'))
  const topicGroup = Array.from(country.children).find((element) => element.classList.contains('tags'))
  const content = Array.from(country.children)
    .filter((element) => element !== header && element !== topicGroup)
    .map((element) => ({ element, text: element.textContent ?? '' }))

  const topics = topicsWithSourceContent(topicList, content, lang)
  const activeTopic = topics.find((topic) => topic.id === activeTopicId)
  const visibleContent = activeTopic ? activeTopic.matches : content

  if (topicGroup) topicGroup.remove()
  if (activeTopic) {
    const visibleNodes = new Set(visibleContent.map((block) => block.element))
    content.forEach(({ element }) => { if (!visibleNodes.has(element)) element.remove() })
  }

  return { html: country.outerHTML, topics }
}

function CountryTab({ country, active, onSelect, onKeyDown, lang }) {
  return <button
    className={`land-law-country-tab${active ? ' is-active' : ''}`}
    id={`land-law-tab-${country.id}`}
    type="button"
    role="tab"
    aria-selected={active}
    aria-controls="land-law-country-panel"
    tabIndex={active ? 0 : -1}
    onClick={onSelect}
    onKeyDown={onKeyDown}
  >{country[lang]}</button>
}

export default function LandLaw({ lang = 'en' }) {
  const language = lang === 'fr' ? 'fr' : 'en'
  const t = landLawCopy[language]
  const [selectedCountry, setSelectedCountry] = useState(countries[0].id)
  const [activeTopicId, setActiveTopicId] = useState(null)
  const countrySource = landLawCountryMarkup.find((entry) => entry.id === selectedCountry)
  const countryView = useMemo(
    () => countrySource ? translateMarkup(countrySource.markup, language, activeTopicId) : { html: '', topics: [] },
    [countrySource, language, activeTopicId],
  )

  function chooseCountry(id) {
    setSelectedCountry(id)
    setActiveTopicId(null)
  }

  function chooseTopic(id) {
    setActiveTopicId((current) => current === id ? null : id)
  }

  return <section className="main-section land-law-page" aria-labelledby="land-law-page-title">
    <div className="land-law-shell">
      <header className="land-law-title-card">
        <h1 id="land-law-page-title">{t.title}</h1>
        <p>{t.subtitle}</p>
      </header>

      <div className="land-law-country-tabs" role="tablist" aria-label={language === 'fr' ? 'Pays' : 'Countries'}>
        {countries.map((country, index) => <CountryTab
          key={country.id}
          country={country}
          active={selectedCountry === country.id}
          lang={language}
          onSelect={() => chooseCountry(country.id)}
          onKeyDown={(event) => {
            const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
            if (!direction) return
            event.preventDefault()
            const next = countries[(index + direction + countries.length) % countries.length]
            chooseCountry(next.id)
            document.getElementById(`land-law-tab-${next.id}`)?.focus()
          }}
        />)}
      </div>

      <div
        className="land-law-country-panel"
        id="land-law-country-panel"
        role="tabpanel"
        aria-labelledby={`land-law-tab-${selectedCountry}`}
      >
        <div className="land-law-country-content" dangerouslySetInnerHTML={{ __html: countryView.html }} />

        {countryView.topics.length > 0 && <div className="land-law-topics" role="group" aria-label={language === 'fr' ? 'Thèmes juridiques' : 'Legal topics'}>
          {countryView.topics.map((topic) => <button
            key={topic.id}
            type="button"
            className={`land-law-topic${activeTopicId === topic.id ? ' is-active' : ''}`}
            aria-pressed={activeTopicId === topic.id}
            onClick={() => chooseTopic(topic.id)}
          >{topic[language]}</button>)}
        </div>}

        <aside className="land-law-disclaimer">
          <strong>{t.disclaimerTitle}</strong> {t.disclaimer}
        </aside>
      </div>

      <footer className="land-law-footer">
        <strong>{t.footerTitle}</strong>
        <span>{t.footer}</span>
        <span>{t.attorney}</span>
        <span>{t.purpose}</span>
      </footer>
    </div>
  </section>
}
