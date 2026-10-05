import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { AUTH_TRANSLATIONS } from './authTranslations.js'
import { readLanguage, writeLanguage } from './languageStorage.js'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const home = readFileSync(new URL('./pages/Home.jsx', import.meta.url), 'utf8')
const signIn = readFileSync(new URL('./pages/SignIn.jsx', import.meta.url), 'utf8')
const signUp = readFileSync(new URL('./pages/SignUp.jsx', import.meta.url), 'utf8')

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
}

test('Sign In has English and French copy, including its local credential error', () => {
  assert.equal(AUTH_TRANSLATIONS.en.signIn.title, 'Login')
  assert.equal(AUTH_TRANSLATIONS.fr.signIn.title, 'Connexion')
  assert.equal(AUTH_TRANSLATIONS.en.signIn.emailPlaceholder, 'Email address')
  assert.equal(AUTH_TRANSLATIONS.fr.signIn.emailPlaceholder, 'Adresse e-mail')
  assert.equal(AUTH_TRANSLATIONS.en.signIn.invalidCredentials, 'The email address or password is incorrect.')
  assert.equal(AUTH_TRANSLATIONS.fr.signIn.invalidCredentials, 'L’adresse e-mail ou le mot de passe est incorrect.')
  assert.equal(AUTH_TRANSLATIONS.en.signIn.forgotUnavailable, 'Forgot password? — Not available yet')
  assert.equal(AUTH_TRANSLATIONS.fr.signIn.forgotUnavailable, 'Mot de passe oublié ? — Pas encore disponible')
  assert.match(signIn, /import \{ readLanguage \} from '\.\.\/languageStorage\.js'/)
  assert.match(signIn, /AUTH_TRANSLATIONS\[readLanguage\(\)\]\.signIn/)
  assert.match(signIn, /failure\.kind === 'auth' \? copy\.invalidCredentials : failure\.message/)
})

test('Sign Up has English and French copy while preserving backend-provided errors', () => {
  assert.equal(AUTH_TRANSLATIONS.en.signUp.title, 'Create account')
  assert.equal(AUTH_TRANSLATIONS.fr.signUp.title, 'Créer un compte')
  assert.equal(AUTH_TRANSLATIONS.en.signUp.phonePlaceholder, 'Phone number')
  assert.equal(AUTH_TRANSLATIONS.fr.signUp.phonePlaceholder, 'Numéro de téléphone')
  assert.equal(AUTH_TRANSLATIONS.en.signUp.passwordTooShort, 'Password must be at least 6 characters long.')
  assert.equal(AUTH_TRANSLATIONS.fr.signUp.passwordTooShort, 'Le mot de passe doit contenir au moins 6 caractères.')
  assert.equal(AUTH_TRANSLATIONS.en.signUp.accountInUse, 'That email or username is already in use.')
  assert.equal(AUTH_TRANSLATIONS.fr.signUp.accountInUse, 'Cette adresse e-mail ou ce nom d’utilisateur est déjà utilisé.')
  assert.equal(AUTH_TRANSLATIONS.en.signUp.requiredFields, 'Please check the required fields and try again.')
  assert.equal(AUTH_TRANSLATIONS.fr.signUp.requiredFields, 'Vérifiez les champs obligatoires et réessayez.')
  assert.match(signUp, /import \{ readLanguage \} from '\.\.\/languageStorage\.js'/)
  assert.match(signUp, /AUTH_TRANSLATIONS\[readLanguage\(\)\]\.signUp/)
  assert.match(signUp, /else setError\(failure\.message \|\| copy\.registrationFailed\)/)
  assert.match(signUp, /if \(!acquireSubmissionLock\(submitting\)\) return/)
  assert.doesNotMatch(signUp, /localStorage|sessionStorage/)
})

test('App uses canonical language copy for status screens and auth framing', () => {
  assert.match(app, /import \{ readLanguage \} from '\.\/languageStorage\.js'/)
  assert.match(app, /AUTH_TRANSLATIONS\[language\]\.app/)
  assert.match(app, /\{copy\.restoring\}/)
  assert.match(app, /\{copy\.unavailableTitle\}/)
  assert.match(app, /\{copy\.retry\}/)
  assert.match(app, /error\?\.message \?\? copy\.retryHelp/)
  assert.match(app, /error\?\.message/)
  assert.match(app, /\{copy\.redirecting\}/)
  assert.match(app, /aria-label=\{isSignUp \? copy\.signUpCardLabel : copy\.signInCardLabel\}/)
  assert.doesNotMatch(app, /localStorage|sessionStorage/)
})

test('Home preference is read by auth pages after navigation and a page remount', () => {
  const storage = memoryStorage()

  assert.match(home, /import \{ readLanguage, writeLanguage \} from '\.\.\/languageStorage\.js'/)
  assert.match(home, /writeLanguage\(lang\)/)
  assert.match(home, /href="\/signin"/)
  assert.match(home, /href="\/signup"/)
  assert.match(signIn, /AUTH_TRANSLATIONS\[readLanguage\(\)\]\.signIn/)
  assert.match(signUp, /AUTH_TRANSLATIONS\[readLanguage\(\)\]\.signUp/)
  assert.doesNotMatch(signIn, /localStorage|sessionStorage/)

  assert.equal(writeLanguage('fr', storage), true)
  const firstPageCopy = AUTH_TRANSLATIONS[readLanguage(storage)]
  assert.equal(firstPageCopy.signIn.title, 'Connexion')
  assert.equal(firstPageCopy.signUp.title, 'Créer un compte')

  assert.equal(AUTH_TRANSLATIONS[readLanguage(storage)].app.retry, 'Réessayer')
  assert.equal(writeLanguage('en', storage), true)
  assert.equal(AUTH_TRANSLATIONS[readLanguage(storage)].signIn.title, 'Login')
})
