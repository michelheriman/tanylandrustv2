import { useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth.js'
import Icon from '../components/Icon.jsx'

export default function SignUp() {
  const { register } = useAuth()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const errorRef = useRef(null)

  async function handleSubmit(event) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const password = values.get('password')

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      requestAnimationFrame(() => errorRef.current?.focus())
      return
    }

    setPending(true)
    setError(null)
    try {
      await register({
        name: values.get('name').trim(),
        email: values.get('email').trim(),
        password,
        username: values.get('username').trim(),
        mobile: values.get('mobile').trim(),
        account: values.get('account'),
      })
      form.reset()
      setSuccess(true)
      window.setTimeout(() => window.location.assign('/signin'), 2000)
    } catch (failure) {
      if (failure.status === 409) setError('That email or username is already in use.')
      else if (failure.status === 400) setError('Please check the required fields and try again.')
      else setError(failure.message || 'Registration failed. Please try again.')
      requestAnimationFrame(() => errorRef.current?.focus())
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <a className="back-link" href="/signin">
        <Icon name="arrow-left" size={15}/> Back to sign in
      </a>
      <header className="card-heading">
        <h1>Create account</h1>
        <p>Free to join — takes less than a minute</p>
      </header>
      <form className="signup-form" onSubmit={handleSubmit} aria-busy={pending}>
        <div className="form-field">
          <label className="sr-only" htmlFor="signup-name">Full name</label>
          <input id="signup-name" name="name" type="text" autoComplete="name" placeholder="Full name" required readOnly={pending || success} />
        </div>
        <div className="form-field">
          <label className="sr-only" htmlFor="signup-email">Email address</label>
          <input id="signup-email" name="email" type="email" autoComplete="email" placeholder="Email address" required spellCheck="false" readOnly={pending || success} />
        </div>
        <div className="form-field">
          <label className="sr-only" htmlFor="signup-username">Username</label>
          <input id="signup-username" name="username" type="text" autoComplete="username" placeholder="Username" required spellCheck="false" readOnly={pending || success} />
        </div>
        <div className="form-field">
          <label className="sr-only" htmlFor="signup-password">Password</label>
          <input id="signup-password" name="password" type="password" autoComplete="new-password" placeholder="Password" required minLength={6} readOnly={pending || success} />
        </div>
        <div className="form-field">
          <label className="sr-only" htmlFor="signup-mobile">Phone number</label>
          <input id="signup-mobile" name="mobile" type="tel" autoComplete="tel" placeholder="Phone number" required readOnly={pending || success} />
        </div>
        <div className="form-field">
          <label className="sr-only" htmlFor="signup-account">Account plan</label>
          <select id="signup-account" name="account" defaultValue="free" required disabled={pending || success}>
            <option value="free">Free plan</option>
            <option value="pro5">Pro — Tier 1</option>
            <option value="pro10">Pro — Tier 2</option>
            <option value="pro">Pro — Tier 3</option>
          </select>
        </div>
        <p className="signup-terms">
          By creating an account you agree to Tany&apos;s <a href="/terms" target="_blank" rel="noreferrer">Terms of Use</a> and <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
        </p>
        <button type="submit" disabled={pending || success}>
          {pending ? 'Creating account…' : success ? 'Account created' : 'Create account'}
        </button>
        <p className="message error" role="alert" aria-live="polite" tabIndex={-1} ref={errorRef} hidden={!error}>{error}</p>
        <p className="message signup-success" role="status" aria-live="polite" hidden={!success}>Registration successful. Please check your email for confirmation.</p>
      </form>
      <p className="signup-prompt">Already have an account? <a href="/signin">Sign in</a></p>
    </>
  )
}
