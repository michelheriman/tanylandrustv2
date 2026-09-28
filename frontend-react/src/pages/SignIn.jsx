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
      <a className="back-link" href="/">
        <span aria-hidden="true">←</span> Back to home
      </a>
      <header className="card-heading">
        <h1>Login</h1>
      </header>
      <form onSubmit={handleSubmit} aria-busy={pending}>
        <div className="form-field">
          <label className="sr-only" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required spellCheck="false" placeholder="Email address" readOnly={pending} />
        </div>
        <div className="form-field">
          <label className="sr-only" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required placeholder="Password" readOnly={pending} />
        </div>
        <div className="login-options">
          <a href="#forgot-password">Forgot password?</a>
        </div>
        <button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
        <p className="message error" role="alert" tabIndex={-1} ref={errorRef} hidden={!error}>{error}</p>
      </form>
      <p className="signup-prompt">Don't have an account? <a href="/signup">Create one</a></p>
      {sessionError && !error && <p className="message" role="status">{sessionError.message}</p>}
    </>
  )
}
