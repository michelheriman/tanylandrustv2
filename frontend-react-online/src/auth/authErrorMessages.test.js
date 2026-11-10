import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '../api/client.js'
import { signInErrorMessage, signUpErrorMessage } from './authErrorMessages.js'

test('sign-in keeps its localized invalid-credentials message for HTTP 401', () => {
  const error = new ApiError('auth', 'internal auth message', 401)
  assert.match(signInErrorMessage(error, 'fr'), /adresse e-mail ou le mot de passe est incorrect/)
  assert.match(signInErrorMessage(error, 'en'), /email address or password is incorrect/)
})

test('sign-up keeps localized business messages for HTTP 400 and 409', () => {
  assert.match(signUpErrorMessage(new ApiError('request', 'internal', 400), 'fr'), /champs obligatoires/)
  assert.match(signUpErrorMessage(new ApiError('request', 'internal', 400), 'en'), /required fields/)
  assert.match(signUpErrorMessage(new ApiError('request', 'internal', 409), 'fr'), /déjà utilisé/)
  assert.match(signUpErrorMessage(new ApiError('request', 'internal', 409), 'en'), /already in use/)
})

test('generic auth form failures are localized and do not reveal internal messages', () => {
  const error = new ApiError('network', 'private diagnostic detail')
  assert.match(signInErrorMessage(error, 'fr'), /contacter le serveur/)
  assert.match(signInErrorMessage(error, 'en'), /Unable to reach the server/)
  assert.match(signUpErrorMessage(error, 'fr'), /contacter le serveur/)
  assert.match(signUpErrorMessage(error, 'en'), /Unable to reach the server/)
  assert.equal(signUpErrorMessage(error, 'en').includes('private diagnostic detail'), false)
})
