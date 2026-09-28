import { useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth.js'

export default function SignIn() {
  const { login, error: sessionError } = useAuth()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const submitting = useRef(false)
  const errorRef = useRef(null)

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting.current) return
    const form = event.currentTarget
    const values = new FormData(form)
    submitting.current = true
    setPending(true)
    setError(null)
    try {
      await login(values.get('email').trim(), values.get('password'))
      form.reset()
    } catch (failure) {
      setError(failure.kind === 'auth' ? 'Adresse e-mail ou mot de passe incorrect.' : failure.message)
      requestAnimationFrame(() => errorRef.current?.focus())
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return (
    <>
      <header className="card-heading">
        <p className="eyebrow">Tany | LandTrust</p>
        <h1>Accédez à votre espace LandTrust</h1>
        <p>Connectez-vous pour gérer vos annonces, documents et transactions foncières à Madagascar.</p>
      </header>
      <form onSubmit={handleSubmit} aria-busy={pending}>
        <div className="form-field">
          <label htmlFor="email">Adresse e-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" required spellCheck="false" placeholder="vous@exemple.com" readOnly={pending} />
        </div>
        <div className="form-field">
          <label htmlFor="password">Mot de passe</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required readOnly={pending} />
        </div>
        <button type="submit" disabled={pending}>{pending ? 'Connexion en cours…' : 'Se connecter'}</button>
        <p className="message error" role="alert" tabIndex={-1} ref={errorRef} hidden={!error}>{error}</p>
      </form>
      {sessionError && !error && <p className="message" role="status">{sessionError.message}</p>}
    </>
  )
}
