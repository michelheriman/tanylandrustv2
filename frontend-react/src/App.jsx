import { useEffect } from 'react'
import { useAuth } from './auth/useAuth.js'
import SignIn from './pages/SignIn.jsx'
import './App.css'

function AccountPage() {
  const { user, logout, status, error } = useAuth()

  return (
    <section className="account-panel" aria-labelledby="account-title">
      <p className="eyebrow">Espace sécurisé</p>
      <h1 id="account-title">Bienvenue{user.name ? `, ${user.name}` : ''}</h1>
      <p className="account-email">{user.email}</p>
      <div className="account-details">
        <span className="status-mark" aria-hidden="true" />
        <p>Vous êtes connecté à votre espace Tany LandTrust.</p>
      </div>
      <button className="signout-button" type="button" onClick={() => void logout()} disabled={status === 'signingOut'}>
        {status === 'signingOut' ? 'Déconnexion…' : 'Se déconnecter'}
      </button>
      {error && <p className="message" role="status">{error.message}</p>}
    </section>
  )
}

function App() {
  const { status, error, restore } = useAuth()

  useEffect(() => {
    document.title = status === 'authenticated' ? 'Mon espace | Tany LandTrust' : 'Connexion | Tany LandTrust'
  }, [status])

  if (status === 'restoring') {
    return <main className="status-screen" role="status" aria-live="polite">Restauration de votre session…</main>
  }

  if (status === 'unavailable') {
    return (
      <main className="status-screen">
        <section className="status-panel" aria-labelledby="restore-title">
          <p className="eyebrow">Tany | LandTrust</p>
          <h1 id="restore-title">Votre espace est momentanément inaccessible</h1>
          <p role="alert">{error?.message ?? 'Vérifiez votre connexion puis réessayez.'}</p>
          <button type="button" onClick={() => void restore({ retry: true })}>Réessayer</button>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-layout">
      <aside className="brand-panel" aria-label="Tany LandTrust">
        <div className="brand-lockup"><span className="brand-symbol" aria-hidden="true">T</span><span>TANY</span></div>
        <div className="brand-copy">
          <p className="eyebrow">LandTrust · Madagascar</p>
          <p className="brand-title">La terre, en confiance.</p>
        </div>
        <div className="map-lines" aria-hidden="true" />
        <p className="brand-coordinate">18°54' S&nbsp;&nbsp; 47°31' E</p>
      </aside>
      <div className="form-panel">
        {status === 'authenticated' || status === 'signingOut' ? <AccountPage /> : <SignIn />}
        <footer className="page-footer"><span>© Tany LandTrust</span><span>Madagascar</span></footer>
      </div>
    </main>
  )
}

export default App
