import { useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth.js'
import Icon from '../components/Icon.jsx'
import { acquireSubmissionLock, releaseSubmissionLock } from './signupSubmission.js'
import { readLanguage } from '../languageStorage.js'
import { AUTH_TRANSLATIONS } from '../authTranslations.js'
import { signUpErrorMessage } from '../auth/authErrorMessages.js'

export default function SignUp() {
  const { register } = useAuth()
  const lang = readLanguage()
  const copy = AUTH_TRANSLATIONS[lang].signUp
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const submitting = useRef(false)
  const errorRef = useRef(null)

  async function handleSubmit(event) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const password = values.get('password')

    if (password.length < 6) {
      setError(copy.passwordTooShort)
      requestAnimationFrame(() => errorRef.current?.focus())
      return
    }

    if (!acquireSubmissionLock(submitting)) return
    setPending(true)
    setError(null)
    try {
      await register({
        name: values.get('name').trim(),
        email: values.get('email').trim(),
        password,
        username: values.get('username').trim(),
        mobile: values.get('mobile').trim(),
      })
      form.reset()
      setSuccess(true)
      window.setTimeout(() => window.location.assign('/signin'), 2000)
    } catch (failure) {
      setError(signUpErrorMessage(failure, lang))
      requestAnimationFrame(() => errorRef.current?.focus())
    } finally {
      releaseSubmissionLock(submitting)
      setPending(false)
    }
  }

  return (
    <>
      <a className="back-link" href="/signin">
        <Icon name="arrow-left" size={15}/> {copy.backToSignIn}
      </a>
      <header className="card-heading">
        <h1>{copy.title}</h1>
        <p>{copy.subtitle}</p>
      </header>
      <form className="signup-form" onSubmit={handleSubmit} aria-busy={pending}>
        <div className="form-field">
          <label className="sr-only" htmlFor="signup-name">{copy.nameLabel}</label>
          <input id="signup-name" name="name" type="text" autoComplete="name" placeholder={copy.namePlaceholder} required readOnly={pending || success} />
        </div>
        <div className="form-field">
          <label className="sr-only" htmlFor="signup-email">{copy.emailLabel}</label>
          <input id="signup-email" name="email" type="email" autoComplete="email" placeholder={copy.emailPlaceholder} required spellCheck="false" readOnly={pending || success} />
        </div>
        <div className="form-field">
          <label className="sr-only" htmlFor="signup-username">{copy.usernameLabel}</label>
          <input id="signup-username" name="username" type="text" autoComplete="username" placeholder={copy.usernamePlaceholder} required spellCheck="false" readOnly={pending || success} />
        </div>
        <div className="form-field">
          <label className="sr-only" htmlFor="signup-password">{copy.passwordLabel}</label>
          <input id="signup-password" name="password" type="password" autoComplete="new-password" placeholder={copy.passwordPlaceholder} required minLength={6} readOnly={pending || success} />
        </div>
        <div className="form-field signup-phone-field">
          <label className="sr-only" htmlFor="signup-mobile">{copy.phoneLabel}</label>
          <input id="signup-mobile" name="mobile" type="tel" autoComplete="tel" placeholder={copy.phonePlaceholder} required readOnly={pending || success} />
        </div>
        <p className="signup-terms">
          {copy.termsPrefix} <a href="/terms" target="_blank" rel="noreferrer">{copy.termsLink}</a> {copy.termsJoin} <a href="/privacy" target="_blank" rel="noreferrer">{copy.privacyLink}</a>{copy.termsSuffix}
        </p>
        <button type="submit" disabled={pending || success}>
          {pending ? copy.creating : success ? copy.created : copy.submit}
        </button>
        <p className="message error" role="alert" aria-live="polite" tabIndex={-1} ref={errorRef} hidden={!error}>{error}</p>
        <p className="message signup-success" role="status" aria-live="polite" hidden={!success}>{copy.success}</p>
      </form>
      <p className="signup-prompt">{copy.haveAccount} <a href="/signin">{copy.signIn}</a></p>
    </>
  )
}
