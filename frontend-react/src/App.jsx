import { useEffect } from 'react'
import { useAuth } from './auth/useAuth.js'
import SignIn from './pages/SignIn.jsx'
import SignUp from './pages/SignUp.jsx'
import Home from './pages/Home.jsx'
import Main from './pages/Main.jsx'
import './App.css'

function App() {
  const { status, error, restore } = useAuth()
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
  const isHome = pathname === '/'
  const isMain = pathname === '/main' || pathname === '/main.html'
  const isSignUp = pathname === '/signup'

  useEffect(() => {
    if (isHome || status === 'authenticated') return
    document.title = status === 'authenticated' ? 'Dashboard | Tany LandTrust' : `${isSignUp ? 'Sign up' : 'Login'} | Tany LandTrust`
  }, [isHome, isSignUp, status])

  useEffect(() => {
    if (isHome) return
    if (status === 'authenticated' && !isMain) window.history.replaceState(null, '', '/main')
    if (status === 'anonymous' && isMain) window.location.replace('/signin')
  }, [isHome, isMain, status])

  // Keep the landing page public even when restoring a saved session is unavailable.
  if (isHome) return <Home />

  if (status === 'restoring') {
    return <main className="status-screen" role="status" aria-live="polite">Restoring your session…</main>
  }

  if (status === 'unavailable') {
    return (
      <main className="status-screen">
        <section className="status-panel" aria-labelledby="restore-title">
          <p className="eyebrow">Tany | LandTrust</p>
          <h1 id="restore-title">Your dashboard is temporarily unavailable</h1>
          <p role="alert">{error?.message ?? 'Check your connection and try again.'}</p>
          <button type="button" onClick={() => void restore({ retry: true })}>Try again</button>
        </section>
      </main>
    )
  }

  if (status === 'authenticated' || status === 'signingOut') return <Main />

  if (isMain) return <main className="status-screen" role="status">Redirecting to sign in…</main>

  return (
    <main className="auth-scene">
      <section className="auth-card" aria-label={isSignUp ? 'Tany LandTrust sign up' : 'Tany LandTrust login'}>
        <aside className="brand-panel">
          <p className="brand-name">Tany | LandTrust</p>
          <div className="brand-copy">
            <h1>{isSignUp ? 'Create your LandTrust account' : 'Access your LandTrust Dashboard'}</h1>
            <p>{isSignUp ? 'Join Tany to manage your land, documents, and transactions with confidence.' : 'Manage your land, documents, and transactions with confidence, all in one place.'}</p>
          </div>
        </aside>
        <section className="form-panel" aria-label={isSignUp ? 'Create account' : 'Sign in'}>
          {isSignUp ? <SignUp /> : <SignIn />}
        </section>
      </section>
    </main>
  )
}

export default App
