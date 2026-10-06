import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ApiError } from './client.js'
import { apiErrorMessage } from './apiErrorMessages.js'

test('network and protocol errors have localized user copy', () => {
  const network = new ApiError('network', 'internal network message')
  const protocol = new ApiError('protocol', 'internal protocol message', 200)

  assert.match(apiErrorMessage(network, 'fr'), /contacter le serveur/)
  assert.match(apiErrorMessage(network, 'en'), /Unable to reach the server/)
  assert.match(apiErrorMessage(protocol, 'fr'), /réponse invalide/)
  assert.match(apiErrorMessage(protocol, 'en'), /invalid response/)
})

test('403 and 404 are distinct in French and English', () => {
  const forbidden = new ApiError('request', 'internal request message', 403)
  const notFound = new ApiError('request', 'internal request message', 404)

  assert.match(apiErrorMessage(forbidden, 'fr'), /autorisation/)
  assert.match(apiErrorMessage(forbidden, 'en'), /do not have permission/)
  assert.match(apiErrorMessage(notFound, 'fr'), /ressource demandée est introuvable/)
  assert.match(apiErrorMessage(notFound, 'en'), /resource was not found/)
  assert.notEqual(apiErrorMessage(forbidden, 'en'), apiErrorMessage(notFound, 'en'))
})

test('500 and 503 share localized temporary-unavailability copy', () => {
  for (const status of [500, 503]) {
    const error = new ApiError('server', 'internal server message', status)
    assert.match(apiErrorMessage(error, 'fr'), /temporairement indisponible/)
    assert.match(apiErrorMessage(error, 'en'), /temporarily unavailable/)
  }
})

test('localized presentation preserves the technical status and ignores internal messages', () => {
  const error = new ApiError('server', 'PRIVATE backend detail', 503)
  const message = apiErrorMessage(error, 'en')

  assert.equal(error.status, 503)
  assert.equal(message.includes('PRIVATE backend detail'), false)
  assert.equal(apiErrorMessage(new Error('plain application error'), 'fr'), null)
})

test('Main, KML, App, Marketplace, Chat and auth forms use localized API presentation', () => {
  const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const main = source('../pages/Main.jsx')
  const kml = source('../pages/KmlImport.jsx')
  const app = source('../App.jsx')
  const market = source('../pages/Marketplace.jsx')
  const chat = source('../pages/Chat.jsx')
  const signIn = source('../pages/SignIn.jsx')
  const signUp = source('../pages/SignUp.jsx')

  assert.match(main, /apiErrorMessage\(addError, lang\)/)
  assert.match(main, /apiErrorMessage\(editError, lang\)/)
  assert.match(main, /apiErrorMessage\(error, lang\)/)
  assert.match(kml, /apiErrorMessage\(failure, lang\)/)
  assert.match(app, /apiErrorMessage\(error, language\)/)
  assert.match(market, /apiErrorMessage\(error, lang\)/)
  assert.match(chat, /apiErrorMessage\(error, lang\)/)
  assert.match(signIn, /signInErrorMessage\(failure, lang\)/)
  assert.match(signUp, /signUpErrorMessage\(failure, lang\)/)
})
