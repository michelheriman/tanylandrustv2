import { useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth.js'
import Icon from '../components/Icon.jsx'
import { readLanguage } from '../languageStorage.js'
import { AUTH_TRANSLATIONS } from '../authTranslations.js'
import { apiErrorMessage } from '../api/apiErrorMessages.js'
import { signInErrorMessage } from '../auth/authErrorMessages.js'

export default function SignIn() {
  const { login, error: sessionError } = useAuth()
  const lang = readLanguage()
  const copy = AUTH_TRANSLATIONS[lang].signIn
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
      setError(signInErrorMessage(failure, lang))
      requestAnimationFrame(() => errorRef.current?.focus())
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return (
    <>
      <a className="back-link" href="/">
        <Icon name="arrow-left" size={15}/> {copy.backHome}
      </a>
      <header className="card-heading">
        <h1>{copy.title}</h1>
      </header>
      <form onSubmit={handleSubmit} aria-busy={pending}>
        <div className="form-field">
          <label className="sr-only" htmlFor="email">{copy.emailLabel}</label>
          <input id="email" name="email" type="email" autoComplete="email" required spellCheck="false" placeholder={copy.emailPlaceholder} readOnly={pending} />
        </div>
        <div className="form-field">
          <label className="sr-only" htmlFor="password">{copy.passwordLabel}</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required placeholder={copy.passwordPlaceholder} readOnly={pending} />
        </div>
        <div className="login-options">
          <span className="login-options-unavailable">{copy.forgotUnavailable}</span>
        </div>
        <button type="submit" disabled={pending}>{pending ? copy.signingIn : copy.submit}</button>
        <p className="message error" role="alert" tabIndex={-1} ref={errorRef} hidden={!error}>{error}</p>
      </form>
      <p className="signup-prompt">{copy.noAccount} <a href="/signup">{copy.createAccount}</a></p>
      {sessionError && !error && <p className="message" role="status">{apiErrorMessage(sessionError, lang) || copy.requestFailed}</p>}
    </>
  )
}
