import { useEffect, useState } from 'react'
import { HOME_TRANSLATIONS } from '../homeTranslations.js'
import { readLanguage, writeLanguage } from '../languageStorage.js'
import { applyPageMetadata } from '../seoMetadata.js'
import AppIcon from '../components/Icon.jsx'
import './Home.css'

const numbers = [12400, 98, 34]
const trustIcons = { trust1: 'lock', trust2: 'map', trust3: 'scales', trust4: 'mobile' }

const pillarKeys = [
  { title: 'f1_title', body: 'f1_desc', list: ['f1_li1', 'f1_li2', 'f1_li3'], icon: 'parcel' },
  { title: 'f2_title', body: 'f2_desc', list: ['f2_li1', 'f2_li2', 'f2_li3'], icon: 'globe' },
  { title: 'f3_title', body: 'f3_desc', list: ['f3_li1', 'f3_li2', 'f3_li3'], icon: 'message' },
]

const gisKeys = [
  ['01', 'gis_f1_title', 'gis_f1_desc'],
  ['02', 'gis_f2_title', 'gis_f2_desc'],
  ['03', 'gis_f3_title', 'gis_f3_desc'],
]

const plans = [
  { name: 'p0_name', price: '$0', tagline: 'p0_tagline', features: ['p0_li1', 'p0_li2', 'p0_li3', 'p0_li4'], cta: 'p0_btn' },
  { name: 'p1_name', price: '$5', tagline: 'p1_tagline', features: ['p1_li1', 'p1_li2', 'p1_li3', 'p1_li4'], cta: 'p1_btn' },
  { name: 'p2_name', price: '$10', tagline: 'p2_tagline', features: ['p2_li1', 'p2_li2', 'p2_li3', 'p2_li4'], cta: 'p2_btn', popular: true },
  { name: 'p3_name', price: '$25', tagline: 'p3_tagline', features: ['p3_li1', 'p3_li2', 'p3_li3', 'p3_li4'], cta: 'p3_btn' },
]

function Brand({ footer = false, ariaLabel }) {
  return (
    <a className={`home-brand${footer ? ' home-brand-footer' : ''}`} href="/" aria-label={ariaLabel}>
      {!footer && <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 18 18" fill="none"><path d="M9 1.5 15.5 5.25v7.5L9 16.5l-6.5-3.75v-7.5L9 1.5Z" stroke="currentColor" strokeWidth="1.35"/><path d="M9 1.5v15m-6.5-11.25L9 9l6.5-3.75" stroke="currentColor" strokeWidth="1"/></svg></span>}
      <span>{footer ? <>Tany <em>Landtrust</em></> : <>tany <em>Landtrust</em></>}</span>
    </a>
  )
}

function Icon({ name }) {
  if (name === 'parcel') return <svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><rect x="3" y="7" width="22" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M9 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M3 13h22" stroke="currentColor" strokeWidth="1.5"/><circle cx="14" cy="17" r="2" stroke="currentColor" strokeWidth="1.5"/></svg>
  if (name === 'globe') return <svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="1.5"/><ellipse cx="14" cy="14" rx="4" ry="10" stroke="currentColor"/><path d="M4 14h20" stroke="currentColor"/></svg>
  return <svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M5 7h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-7 4V7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 12h9m-9 3h6" stroke="currentColor" strokeWidth="1.5"/></svg>
}

function Home() {
  const [lang, setLang] = useState(readLanguage)
  const [counts, setCounts] = useState(numbers)
  const t = (key) => HOME_TRANSLATIONS[lang][key] ?? HOME_TRANSLATIONS.en[key] ?? key
  const rich = (key) => ({ __html: t(key) })

  useEffect(() => {
    applyPageMetadata('home', lang)
    writeLanguage(lang)
  }, [lang])

  useEffect(() => {
    const updateNav = () => document.querySelector('.home-nav')?.classList.toggle('is-scrolled', window.scrollY > 40)
    window.addEventListener('scroll', updateNav, { passive: true })
    return () => window.removeEventListener('scroll', updateNav)
  }, [])

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const revealElements = document.querySelectorAll('.home-reveal')
    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealElements.forEach((element) => element.classList.add('is-visible'))
      return undefined
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -32px 0px' })
    revealElements.forEach((element) => observer.observe(element))

    let animationFrame
    let startedAt = null
    const animate = (timestamp) => {
      if (startedAt === null) startedAt = timestamp
      const progress = Math.min((timestamp - startedAt) / 1600, 1)
      const eased = 1 - (1 - progress) ** 3
      setCounts(numbers.map((number) => Math.floor(eased * number)))
      if (progress < 1) animationFrame = requestAnimationFrame(animate)
    }
    const hero = document.querySelector('.home-hero-stats')
    const statsObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        animationFrame = requestAnimationFrame(animate)
        statsObserver.disconnect()
      }
    }, { threshold: 0.5 })
    if (hero) statsObserver.observe(hero)

    return () => {
      observer.disconnect()
      statsObserver.disconnect()
      if (animationFrame) cancelAnimationFrame(animationFrame)
    }
  }, [])

  return (
    <div className="landing-page">
      <header className="home-nav">
        <div className="home-nav-inner">
          <Brand ariaLabel={t('brand_home_aria')} />
          <nav className="home-nav-links" aria-label={t('main_navigation_aria')}>
            <a href="#features">{t('nav_features')}</a><a href="#gis">{t('nav_gis')}</a><a href="#negotiation">{t('nav_negotiation')}</a><a href="#pricing">{t('nav_pricing')}</a>
          </nav>
          <div className="home-nav-actions">
            <a className="nav-signin" href="/signin">{t('nav_signin')}</a>
            <details className="language-menu">
              <summary aria-label={t('language_selected_aria')}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>
                <span>{lang.toUpperCase()}</span><i aria-hidden="true" />
              </summary>
              <div className="language-menu-options" role="group" aria-label={t('language_options_aria')}>
                {['en', 'fr'].map((language) => <button key={language} type="button" lang={language} aria-pressed={lang === language} onClick={() => setLang(language)}>{language.toUpperCase()}</button>)}
              </div>
            </details>
            <details className="mobile-nav">
              <summary aria-label={t('open_navigation_aria')}><AppIcon name="menu" size={18}/></summary>
              <nav aria-label={t('mobile_navigation_aria')}>
                <a href="#features">{t('nav_features')}</a><a href="#gis">{t('nav_gis')}</a><a href="#negotiation">{t('nav_negotiation')}</a><a href="#pricing">{t('nav_pricing')}</a>
                <a className="mobile-auth-link" href="/signin">{t('nav_signin')}</a><a className="mobile-auth-link" href="/signup">{t('nav_cta')}</a>
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main>
        <section className="home-hero">
          <div className="home-container hero-content">
            <div className="hero-copy">
              <span className="hero-badge"><span></span>{t('hero_badge')}</span>
              <h1><span>{t('hero_h1_line1')}</span><br/><em>{t('hero_h1_line2')}</em><br/><span>{t('hero_h1_line3')}</span></h1>
              <p className="hero-description">{t('hero_sub')}</p>
              <div className="hero-buttons">
                <a className="button button-amber" href="/signup">{t('hero_cta_primary')}<AppIcon name="arrow-right" size={15}/></a>
                <a className="button button-outline" href="#features">{t('hero_cta_secondary')}</a>
              </div>
              <div className="home-hero-stats" aria-label={t('stats_aria')}>
                {[['stat0', 'stat0_label', '+'], ['stat1', 'stat1_label', '%'], ['stat2', 'stat2_label', '']].map(([id, label, suffix], index) => <div className="hero-stat" key={id}><strong>{counts[index].toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}<span>{suffix}</span></strong><span>{t(label)}</span></div>)}
                <p>{lang === 'fr' ? 'Chiffres indicatifs, à vérifier.' : 'Illustrative figures, pending verification.'}</p>
              </div>
            </div>
            <a className="hero-scroll" href="#trust"><span>{t('scroll_hint')}</span><i></i></a>
          </div>
        </section>

        <section className="trust-bar" id="trust" aria-label={t('platform_principles_aria')}>
          <div className="home-container trust-items">{['trust1', 'trust2', 'trust3', 'trust4'].map((key) => <span key={key}><AppIcon name={trustIcons[key]} size={15}/>{t(key)}</span>)}</div>
        </section>

        <section className="home-section features-section" id="features">
          <div className="home-container">
            <div className="section-heading home-reveal"><p className="section-eyebrow">{t('feat_eyebrow')}</p><h2>{t('feat_h2_line1')}<br/><em>{t('feat_h2_line2')}</em></h2></div>
            <div className="pillar-grid">{pillarKeys.map((pillar, index) => <article className="pillar-card home-reveal" key={pillar.title} style={{ '--reveal-delay': `${index * 80}ms` }}>
              <span className="pillar-icon"><Icon name={pillar.icon}/></span><h3>{t(pillar.title)}</h3><p>{t(pillar.body)}</p><ul>{pillar.list.map((key) => <li key={key}><AppIcon name="check" size={14}/>{t(key)}</li>)}</ul>
            </article>)}</div>
          </div>
        </section>

        <section className="home-section gis-section" id="gis">
          <div className="home-container gis-grid">
            <div className="gis-copy home-reveal"><p className="section-eyebrow">{t('gis_eyebrow')}</p><h2>{t('gis_h2_line1')}<br/><em>{t('gis_h2_line2')}</em></h2><p className="section-intro">{t('gis_intro')}</p><a className="gis-cta" href="/signup">{t('gis_dl_btn')}<AppIcon name="arrow-right" size={15}/></a>
              <div className="report-card home-reveal">
              <header><strong>{t('gis_panel_title')}</strong><span>Pro</span></header>
              <div className="report-map" aria-label={t('illustrative_map_aria')}><svg viewBox="0 0 320 176" fill="none" aria-hidden="true"><rect width="320" height="176" fill="#102820"/><g stroke="#4a8c5c"><ellipse cx="160" cy="88" rx="150" ry="80"/><ellipse cx="160" cy="88" rx="120" ry="62"/><ellipse cx="160" cy="88" rx="90" ry="46"/><ellipse cx="160" cy="88" rx="62" ry="32"/></g><path d="m80 40 160 15-15 80-160-15 15-80Z" fill="#e4a85a12" stroke="#e4a85a" strokeDasharray="6 3"/><circle cx="160" cy="88" r="4" fill="#8dcc85"/><text x="132" y="108" fill="#8dcc85" fontSize="9">{t('peak_label')} 1242 m</text></svg><span>Tany GIS</span></div>
              <div className="report-facts">{[['gis_d1_label', '12.4°', 'gis_d1_val'], ['gis_d2_label', 'Ferralsol', 'pH 5.8'], ['gis_d3_label', '3.2 km', 'Antananarivo'], ['gis_d4_label', 'gis_d4_val', 'Zone C']].map(([label, value, sub]) => <div key={label}><span>{t(label)}</span><strong>{label === 'gis_d4_label' ? t(value) : value}</strong><small>{label === 'gis_d1_label' ? t(sub) : sub}</small></div>)}</div>
              <p className="report-caption">{lang === 'fr' ? 'Exemple illustratif, données non vérifiées' : 'Illustrative example, data not verified'}</p>
              </div>
            </div>
            <div className="gis-features home-reveal" style={{ '--reveal-delay': '120ms' }}>{gisKeys.map(([icon, title, desc]) => <article className="gis-feature" key={title}><span aria-hidden="true">{icon}</span><div><h3>{t(title)}</h3><p>{t(desc)}</p></div></article>)}</div>
          </div>
        </section>

        <section className="home-section negotiation-section" id="negotiation">
          <div className="home-container negotiation-grid">
            <article className="thread-card home-reveal"><header><div><strong>{t('neg_thread_title')}</strong><span>{t('neg_thread_sub')}</span></div><span className="thread-status"><span className="thread-status-indicator" aria-hidden="true" />{t('neg_active')}</span></header>
              <div className="thread-messages"><div className="thread-message"><span className="avatar seller">{t('neg_seller_initial')}</span><div><small>{t('neg_msg1_meta')}</small><p dangerouslySetInnerHTML={rich('neg_msg1')}/></div></div>
                <div className="thread-message message-right"><div><small>{t('neg_msg2_meta')}</small><p dangerouslySetInnerHTML={rich('neg_msg2')}/></div><span className="avatar buyer">{t('neg_buyer_initial')}</span></div>
                <div className="thread-message"><span className="avatar seller">{t('neg_seller_initial2')}</span><div><small>{t('neg_msg3_meta')}</small><p dangerouslySetInnerHTML={rich('neg_msg3')}/></div></div>
                <div className="thread-seal"><AppIcon name="scales" size={17}/>{t('neg_seal')}</div>
              </div>
            </article>
            <div className="negotiation-copy home-reveal" style={{ '--reveal-delay': '120ms' }}><p className="section-eyebrow amber-eyebrow">{t('neg_eyebrow')}</p><h2>{t('neg_h2_line1')}<br/><em>{t('neg_h2_line2')}</em></h2><p className="section-intro">{t('neg_intro')}</p><ul className="negotiation-points">{['neg_b1', 'neg_b2', 'neg_b3'].map((key) => <li key={key}><AppIcon name="arrow-right" size={15}/><p dangerouslySetInnerHTML={rich(key)}/></li>)}</ul></div>
          </div>
        </section>

        <section className="home-section pricing-section" id="pricing">
          <div className="home-container"><div className="section-heading pricing-heading home-reveal"><p className="section-eyebrow">{t('price_eyebrow')}</p><h2>{t('price_h2_line1')}<br/><em>{t('price_h2_line2')}</em></h2><p>{t('price_sub')}</p><p className="pricing-disclaimer">{lang === 'fr' ? 'Forfaits et montants indicatifs, à confirmer.' : 'Plan availability and prices are indicative and unverified.'}</p></div>
            <div className="pricing-grid">{plans.map((plan, index) => <article className={`price-card home-reveal${plan.popular ? ' price-popular' : ''}`} key={plan.name} style={{ '--reveal-delay': `${index * 80}ms` }}>{plan.popular && <span className="popular-badge">{t('popular_badge')}</span>}<p className="plan-name">{t(plan.name)}</p><p className="plan-price">{plan.price}<span>{index > 0 && t(['', 'per_month', 'per_month2', 'per_month3'][index])}</span></p><p className="plan-tagline">{t(plan.tagline)}</p><ul>{plan.features.map((key) => <li key={key} dangerouslySetInnerHTML={rich(key)}/>)}</ul><a className="button" href="/signup">{t(plan.cta)}</a></article>)}</div>
            <div className="pricing-notes home-reveal"><p dangerouslySetInnerHTML={rich('footnote1')}/><p dangerouslySetInnerHTML={rich('footnote2')}/></div>
          </div>
        </section>

        <section className="home-section final-cta"><div className="home-container home-reveal"><h2>{t('cta_h2_line1')}<br/><em>{t('cta_h2_line2')}</em><br/>{t('cta_h2_line3')}</h2><p>{t('cta_sub')}</p><div><a className="button button-green" href="/signup">{t('cta_btn1')}</a><a className="button button-outline-light" href="#features">{t('cta_btn2')}</a></div></div></section>
      </main>

      <footer className="home-footer"><div className="home-container"><div className="footer-grid"><div><Brand footer ariaLabel={t('brand_home_aria')}/><p>{t('footer_tagline')}</p></div>
        {[[t('footer_col1'), [['footer_marketplace', '#features'], ['footer_gis', '#gis'], ['footer_negotiation', '#negotiation'], ['footer_api', '#pricing']]], [t('footer_col2'), [['footer_about'], ['footer_blog'], ['footer_careers'], ['footer_contact']]], [t('footer_col3'), [['footer_tos', '/terms'], ['footer_privacy', '/privacy'], ['footer_security']]]].map(([heading, links]) => <div className="footer-column" key={heading}><h3>{heading}</h3>{links.map(([key, href]) => href ? <a href={href} key={key}>{t(key)}</a> : <span key={key}>{t(key)}</span>)}</div>)}
      </div><div className="footer-bottom"><span>{t('footer_copy')}</span><span>{t('footer_made')}</span></div></div></footer>
    </div>
  )
}

export default Home
