import { useEffect } from 'react'
import { useAuth } from './auth/useAuth.js'
import SignIn from './pages/SignIn.jsx'
import './App.css'

function AccountPage() {
  const { user, logout, status, error } = useAuth()

  return (
    <section className="account-panel" aria-labelledby="account-title">
      <p className="account-kicker">Tany | LandTrust</p>
      <h1 id="account-title">Welcome{user.name ? `, ${user.name}` : ''}</h1>
      <p className="account-email">{user.email}</p>
      <div className="account-details">
        <span className="status-mark" aria-hidden="true" />
        <p>You are signed in to your LandTrust dashboard.</p>
      </div>
      <button className="signout-button" type="button" onClick={() => void logout()} disabled={status === 'signingOut'}>
        {status === 'signingOut' ? 'Signing out…' : 'Sign out'}
      </button>
      {error && <p className="message" role="status">{error.message}</p>}
    </section>
  )
}

function App() {
  const { status, error, restore } = useAuth()

  useEffect(() => {
    document.title = status === 'authenticated' ? 'Dashboard | Tany LandTrust' : 'Login | Tany LandTrust'
  }, [status])

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

  return (
    <main className="auth-scene">
      <section className="auth-card" aria-label="Tany LandTrust login">
        <aside className="brand-panel">
          <p className="brand-name">Tany | LandTrust</p>
          <div className="brand-copy">
            <h1>Access your LandTrust Dashboard</h1>
            <p>Manage your land, documents, and transactions with confidence, all in one place.</p>
          </div>
        </aside>
        <section className="form-panel" aria-label="Sign in">
          {status === 'authenticated' || status === 'signingOut' ? <AccountPage /> : <SignIn />}
        </section>
      </section>
    </main>
  )
}

export default App
