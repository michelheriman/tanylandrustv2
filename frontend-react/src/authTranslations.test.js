import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { AUTH_TRANSLATIONS } from './authTranslations.js'
import { readLanguage, writeLanguage } from './languageStorage.js'

const app = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')
const home = readFileSync(new URL('./pages/Home.jsx', import.meta.url), 'utf8')
const signIn = readFileSync(new URL('./pages/SignIn.jsx', import.meta.url), 'utf8')
const signUp = readFileSync(new URL('./pages/SignUp.jsx', import.meta.url), 'utf8')
const appStyles = readFileSync(new URL('./App.css', import.meta.url), 'utf8')
const globalStyles = readFileSync(new URL('./index.css', import.meta.url), 'utf8')

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
  assert.match(signIn, /const lang = readLanguage\(\)/)
  assert.match(signIn, /AUTH_TRANSLATIONS\[lang\]\.signIn/)
  assert.match(signIn, /setError\(signInErrorMessage\(failure, lang\)\)/)
  assert.doesNotMatch(signIn, /setError\(failure\.message/)
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
  assert.match(signUp, /const lang = readLanguage\(\)/)
  assert.match(signUp, /AUTH_TRANSLATIONS\[lang\]\.signUp/)
  assert.match(signUp, /setError\(signUpErrorMessage\(failure, lang\)\)/)
  assert.doesNotMatch(signUp, /setError\(failure\.message/)
  assert.match(signUp, /if \(!acquireSubmissionLock\(submitting\)\) return/)
  assert.doesNotMatch(signUp, /localStorage|sessionStorage/)
})

test('App uses canonical language copy for status screens and auth framing', () => {
  assert.match(app, /import \{ readLanguage \} from '\.\/languageStorage\.js'/)
  assert.match(app, /const language = readLanguage\(\)/)
  assert.match(app, /AUTH_TRANSLATIONS\[language\]\.app/)
  assert.match(app, /\{copy\.restoring\}/)
  assert.match(app, /\{copy\.unavailableTitle\}/)
  assert.match(app, /\{copy\.retry\}/)
  assert.match(app, /apiErrorMessage\(error, language\) \|\| copy\.retryHelp/)
  assert.doesNotMatch(app, /error\?\.message/)
  assert.match(app, /\{copy\.redirecting\}/)
  assert.match(app, /aria-label=\{isSignUp \? copy\.signUpCardLabel : copy\.signInCardLabel\}/)
  assert.doesNotMatch(app, /localStorage|sessionStorage/)
  assert.notEqual(AUTH_TRANSLATIONS.en.app.retry, AUTH_TRANSLATIONS.fr.app.retry)
  assert.notEqual(AUTH_TRANSLATIONS.en.app.unavailableTitle, AUTH_TRANSLATIONS.fr.app.unavailableTitle)
})

test('Home preference is read by auth pages after navigation and a page remount', () => {
  const storage = memoryStorage()

  assert.match(home, /import \{ readLanguage, writeLanguage \} from '\.\.\/languageStorage\.js'/)
  assert.match(home, /writeLanguage\(lang\)/)
  assert.match(home, /href="\/signin"/)
  assert.match(home, /href="\/signup"/)
  assert.match(signIn, /const lang = readLanguage\(\)[\s\S]*?AUTH_TRANSLATIONS\[lang\]\.signIn/)
  assert.match(signUp, /const lang = readLanguage\(\)[\s\S]*?AUTH_TRANSLATIONS\[lang\]\.signUp/)
  assert.doesNotMatch(signIn, /localStorage|sessionStorage/)

  assert.equal(writeLanguage('fr', storage), true)
  const firstPageCopy = AUTH_TRANSLATIONS[readLanguage(storage)]
  assert.equal(firstPageCopy.signIn.title, 'Connexion')
  assert.equal(firstPageCopy.signUp.title, 'Créer un compte')

  assert.equal(AUTH_TRANSLATIONS[readLanguage(storage)].app.retry, 'Réessayer')
  assert.equal(writeLanguage('en', storage), true)
  assert.equal(AUTH_TRANSLATIONS[readLanguage(storage)].signIn.title, 'Login')
})

test('mobile secondary links have larger touch areas without making Forgot password interactive', () => {
  const mobileStyles = appStyles.slice(appStyles.indexOf('@media (max-width: 700px)'), appStyles.indexOf('@media (max-width: 360px)'))

  assert.match(mobileStyles, /\.back-link\s*\{[^}]*min-height:\s*44px;[^}]*padding:\s*8px;/s)
  assert.match(mobileStyles, /\.signup-prompt a,\s*\.signup-terms a\s*\{[^}]*display:\s*inline-flex;[^}]*min-height:\s*44px;[^}]*align-items:\s*center;/s)
  assert.match(appStyles, /\.form-panel button, \.status-panel button, \.signout-button\s*\{\s*min-height:\s*52px;/)
  assert.match(signIn, /<span className="login-options-unavailable">\{copy\.forgotUnavailable\}<\/span>/)
  assert.doesNotMatch(signIn, /<a[^>]*className="login-options-unavailable"|<button[^>]*login-options-unavailable/)
  assert.doesNotMatch(mobileStyles, /\.login-options-unavailable\s*\{[^}]*min-height/)
  assert.doesNotMatch(mobileStyles, /\.back-link[^}]*background|\.signup-prompt a[^}]*background/s)
})

test('mobile auth forms keep a natural scroll layout and fit the narrowest supported viewport', () => {
  const mobileStyles = appStyles.slice(appStyles.indexOf('@media (max-width: 700px)'), appStyles.indexOf('@media (max-width: 360px)'))
  const supportedWidths = [390, 375, 360, 320]

  for (const width of supportedWidths) assert.ok(width >= 320 && width <= 700)
  assert.match(globalStyles, /body\s*\{[^}]*min-width:\s*320px;/s)
  assert.match(appStyles, /\.auth-scene\s*\{[^}]*min-height:\s*100svh;/s)
  assert.doesNotMatch(appStyles, /\.auth-scene\s*\{[^}]*?(?:^|[;\s])height:\s*100(?:vh|svh|dvh)/s)
  assert.match(mobileStyles, /\.auth-card\s*\{[^}]*grid-template-columns:\s*1fr;\s*min-height:\s*auto;/s)
  assert.match(mobileStyles, /\.signup-form\s*\{\s*grid-template-columns:\s*1fr;/)
  assert.match(appStyles, /\.form-field input, \.form-field select\s*\{[^}]*width:\s*100%;\s*min-width:\s*0;\s*min-height:\s*52px;/s)
  assert.match(appStyles, /\.form-panel button, \.status-panel button, \.signout-button\s*\{\s*min-height:\s*52px;/)
  assert.match(appStyles, /\.message\s*\{[^}]*font-size:\s*13px;\s*line-height:\s*1\.5;/s)
  assert.doesNotMatch(appStyles, /\.message\s*\{[^}]*white-space:\s*nowrap/s)
})
