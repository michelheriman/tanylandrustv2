import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { AUTH_TRANSLATIONS } from '../authTranslations.js'

const signInSource = await readFile(new URL('./SignIn.jsx', import.meta.url), 'utf8')
const appStyles = await readFile(new URL('../App.css', import.meta.url), 'utf8')

test('Forgot password is clearly unavailable and is not rendered as an action', () => {
  const notice = signInSource.match(/<span className="login-options-unavailable">\{copy\.forgotUnavailable\}<\/span>/)

  assert.ok(notice)
  assert.equal(AUTH_TRANSLATIONS.en.signIn.forgotUnavailable, 'Forgot password? — Not available yet')
  assert.equal(AUTH_TRANSLATIONS.fr.signIn.forgotUnavailable, 'Mot de passe oublié ? — Pas encore disponible')
  assert.doesNotMatch(notice[0], /href=|onClick=|tabIndex=/i)
  assert.doesNotMatch(signInSource, /<a[^>]*>Forgot password\?/i)
  assert.match(appStyles, /\.login-options-unavailable\s*\{\s*color:\s*rgb\(255 255 255 \/ 58%\);\s*font-size:\s*12px;/)
})
