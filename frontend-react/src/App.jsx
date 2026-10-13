import { lazy, Suspense, useEffect } from 'react'
import { useAuth } from './auth/useAuth.js'
import SignIn from './pages/SignIn.jsx'
import SignUp from './pages/SignUp.jsx'
import Home from './pages/Home.jsx'
import Main from './pages/Main.jsx'
import NotFound from './pages/NotFound.jsx'
import { resolveAuthRoute } from './appRouteState.js'
import { readLanguage } from './languageStorage.js'
import { AUTH_TRANSLATIONS } from './authTranslations.js'
import { apiErrorMessage } from './api/apiErrorMessages.js'
import { applyPageMetadata } from './seoMetadata.js'
import './App.css'

const GeoReport = lazy(() => import('./pages/GeoReport.jsx'))
const LegalPage = lazy(() => import('./pages/LegalPage.jsx'))

function App() {
  const { status, error, restore } = useAuth()
  const language = readLanguage()
  const copy = AUTH_TRANSLATIONS[language].app
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
  const isHome = pathname === '/'
  const isMain = pathname === '/main' || pathname === '/main.html'
  const isSignIn = pathname === '/signin'
  const isSignUp = pathname === '/signup'
  const legalDocument = pathname === '/terms' ? 'terms' : pathname === '/privacy' ? 'privacy' : null
  const reportMatch = pathname.match(/^\/georeport\/([^/]+)$/)
  let parcelUuid = null
  if (reportMatch) {
    try { parcelUuid = decodeURIComponent(reportMatch[1]) } catch { parcelUuid = null }
  }
  const isGeoReport = Boolean(reportMatch && parcelUuid)
  const routeView = resolveAuthRoute(pathname, status, { isGeoReport })
  const metadataPage = isHome ? 'home' : legalDocument || (routeView === 'notFound' ? 'notFound' : routeView === 'georeport' || isGeoReport ? 'geoReport' : routeView === 'main' || isMain ? 'main' : isSignUp ? 'signUp' : 'signIn')
  const pageLoadingFallback = (
    <main className="status-screen" role="status" aria-live="polite">
      {language === 'fr' ? 'Chargement…' : 'Loading…'}
    </main>
  )

  useEffect(() => {
    applyPageMetadata(metadataPage, language)
  }, [metadataPage, language])

  useEffect(() => {
    if (isHome) return
    if (status === 'authenticated' && (isSignIn || isSignUp)) window.history.replaceState(null, '', '/main')
    if (status === 'anonymous' && (isMain || isGeoReport)) window.location.replace('/signin')
  }, [isHome, isMain, isSignIn, isSignUp, isGeoReport, status])

  // Keep the landing page public even when restoring a saved session is unavailable.
  if (isHome) return <Home />
  // Legal documents are public and should not wait for session restoration.
  if (legalDocument) return <Suspense fallback={pageLoadingFallback}><LegalPage document={legalDocument} /></Suspense>

  if (routeView === 'notFound') return <NotFound lang={language} />

  if (routeView === 'restoring') {
    return <main className="status-screen" role="status" aria-live="polite">{copy.restoring}</main>
  }

  if (routeView === 'unavailable') {
    return (
      <main className="status-screen">
        <section className="status-panel" aria-labelledby="restore-title">
          <p className="eyebrow">Tany | LandTrust</p>
          <h1 id="restore-title">{copy.unavailableTitle}</h1>
          <p role="alert">{apiErrorMessage(error, language) || copy.retryHelp}</p>
          <button type="button" onClick={() => void restore({ retry: true })}>{copy.retry}</button>
        </section>
      </main>
    )
  }

  if (routeView === 'georeport') return <Suspense fallback={pageLoadingFallback}><GeoReport parcelUuid={parcelUuid} /></Suspense>

  if (routeView === 'main') return <Main />

  if (routeView === 'redirect') return <main className="status-screen" role="status">{copy.redirecting}</main>

  return (
    <main className="auth-scene">
      <section className="auth-card" aria-label={isSignUp ? copy.signUpCardLabel : copy.signInCardLabel}>
        <aside className="brand-panel">
          <p className="brand-name">Tany | LandTrust</p>
          <div className="brand-copy">
            <h1>{isSignUp ? copy.signUpHeading : copy.signInHeading}</h1>
            <p>{isSignUp ? copy.signUpDescription : copy.signInDescription}</p>
          </div>
        </aside>
        <section className="form-panel" aria-label={isSignUp ? copy.signUpFormLabel : copy.signInFormLabel}>
          {isSignUp ? <SignUp /> : <SignIn />}
        </section>
      </section>
    </main>
  )
}

export default App
