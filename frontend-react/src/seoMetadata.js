import { AUTH_TRANSLATIONS } from './authTranslations.js'

const pageCopy = {
  en: {
    home: {
      title: 'Tany | Landtrust — Land Management and Marketplace',
      description: 'Manage and grow the value of your land with Tany: parcel mapping, land records and a dedicated marketplace.',
    },
    signIn: { description: 'Sign in to your Tany Landtrust account to manage your parcels and land records.' },
    signUp: { description: 'Create a Tany Landtrust account to organize your parcels and access land services.' },
    terms: {
      title: 'Terms of Use | Tany Landtrust',
      description: 'Read the Terms of Use for the Tany Landtrust land marketplace.',
    },
    privacy: {
      title: 'Privacy Policy | Tany Landtrust',
      description: 'Learn how Tany Landtrust collects, uses and protects your personal information.',
    },
    main: { title: 'Land dashboard | Tany Landtrust', description: 'Private Tany Landtrust workspace for managing parcels and land services.' },
    geoReport: { title: 'GeoReport | Tany Landtrust', description: 'Parcel information and geographic indicators from Tany Landtrust.' },
    notFound: {
      title: 'Page not found | Tany Landtrust',
      description: 'The page you requested could not be found. Return to the Tany Landtrust home page.',
    },
  },
  fr: {
    home: {
      title: 'Tany | Landtrust — Gestion et valorisation foncière',
      description: 'Gérez et valorisez vos terres avec Tany : cartographie, suivi des parcelles et marketplace foncière.',
    },
    signIn: { description: 'Connectez-vous à votre espace Tany Landtrust pour gérer vos parcelles et vos démarches foncières.' },
    signUp: { description: 'Créez un compte Tany Landtrust pour organiser vos parcelles et accéder aux services fonciers.' },
    terms: {
      title: 'Conditions d’utilisation | Tany Landtrust',
      description: 'Consultez les conditions d’utilisation de la marketplace foncière Tany Landtrust.',
    },
    privacy: {
      title: 'Politique de confidentialité | Tany Landtrust',
      description: 'Découvrez comment Tany Landtrust collecte, utilise et protège vos données personnelles.',
    },
    main: { title: 'Espace foncier | Tany Landtrust', description: 'Espace privé Tany Landtrust pour gérer les parcelles et les services fonciers.' },
    geoReport: { title: 'GeoReport | Tany Landtrust', description: 'Données de parcelle et indicateurs géographiques de Tany Landtrust.' },
    notFound: {
      title: 'Page introuvable | Tany Landtrust',
      description: 'La page demandée est introuvable. Revenez à l’accueil de Tany Landtrust.',
    },
  },
}

const indexablePages = new Set(['home', 'terms', 'privacy'])

export const NOT_FOUND_COPY = {
  en: { heading: 'Page not found', home: 'Back to home' },
  fr: { heading: 'Page introuvable', home: 'Retour à l’accueil' },
}

export function getPageMetadata(page, language = 'en') {
  const lang = language === 'fr' ? 'fr' : 'en'
  const pageKey = Object.hasOwn(pageCopy[lang], page) ? page : 'notFound'
  const copy = pageCopy[lang][pageKey]
  const authCopy = AUTH_TRANSLATIONS[lang].app
  const title = pageKey === 'signIn' ? authCopy.signInTitle : pageKey === 'signUp' ? authCopy.signUpTitle : copy.title
  const indexable = indexablePages.has(pageKey)

  return {
    lang,
    title,
    description: copy.description,
    indexable,
    robots: indexable ? null : 'noindex, nofollow',
  }
}

function upsertMeta(documentObject, name, content) {
  let meta = documentObject.querySelector(`meta[name="${name}"]`)
  if (!meta) {
    meta = documentObject.createElement('meta')
    meta.setAttribute('name', name)
    documentObject.head.appendChild(meta)
  }
  meta.setAttribute('content', content)
  meta.setAttribute('data-tany-seo', 'true')
  return meta
}

export function applyPageMetadata(page, language, options = {}) {
  const documentObject = options.document ?? globalThis.document
  if (!documentObject?.documentElement) return null

  const metadata = getPageMetadata(page, language)
  documentObject.documentElement.lang = metadata.lang
  documentObject.title = options.title ?? metadata.title
  upsertMeta(documentObject, 'description', options.description ?? metadata.description)

  const robotsMeta = documentObject.querySelector('meta[name="robots"]')
  if (metadata.indexable) {
    if (robotsMeta?.getAttribute('data-tany-seo') === 'true') robotsMeta.remove()
  } else {
    upsertMeta(documentObject, 'robots', metadata.robots)
  }

  return metadata
}
