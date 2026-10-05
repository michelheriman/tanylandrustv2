import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const signInSource = await readFile(new URL('./SignIn.jsx', import.meta.url), 'utf8')
const appStyles = await readFile(new URL('../App.css', import.meta.url), 'utf8')

test('Forgot password is clearly unavailable and is not rendered as an action', () => {
  const notice = signInSource.match(/<span className="login-options-unavailable">([^<]+)<\/span>/)

  assert.ok(notice)
  assert.equal(notice[1], 'Forgot password? — Not available yet')
  assert.doesNotMatch(notice[0], /href=|onClick=|tabIndex=/i)
  assert.doesNotMatch(signInSource, /<a[^>]*>Forgot password\?/i)
  assert.match(appStyles, /\.login-options-unavailable\s*\{\s*color:\s*rgb\(255 255 255 \/ 58%\);\s*font-size:\s*12px;/)
})
