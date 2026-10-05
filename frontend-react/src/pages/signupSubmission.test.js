import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { acquireSubmissionLock, releaseSubmissionLock } from './signupSubmission.js'

const signUpSource = await readFile(new URL('./SignUp.jsx', import.meta.url), 'utf8')

function guardedRegister(lock, register, payload) {
  if (!acquireSubmissionLock(lock)) return undefined
  try {
    return Promise.resolve(register(payload)).finally(() => releaseSubmissionLock(lock))
  } catch (error) {
    releaseSubmissionLock(lock)
    return Promise.reject(error)
  }
}

test('two immediate form submissions invoke register only once', async () => {
  const lock = { current: false }
  let resolveRegister
  let calls = 0
  const register = () => {
    calls += 1
    return new Promise((resolve) => { resolveRegister = resolve })
  }

  const firstSubmission = guardedRegister(lock, register, { email: 'user@example.test' })
  const secondSubmission = guardedRegister(lock, register, { email: 'user@example.test' })

  assert.equal(calls, 1)
  assert.equal(secondSubmission, undefined)

  resolveRegister({ success: true })
  assert.deepEqual(await firstSubmission, { success: true })
  assert.equal(lock.current, false)
})

test('a rejected registration releases the lock so the user can retry', async () => {
  const lock = { current: false }
  let calls = 0
  const register = async () => {
    calls += 1
    if (calls === 1) throw new Error('temporary failure')
    return { success: true }
  }

  await assert.rejects(guardedRegister(lock, register, {}), /temporary failure/)
  assert.equal(lock.current, false)
  assert.deepEqual(await guardedRegister(lock, register, {}), { success: true })
  assert.equal(calls, 2)
  assert.equal(lock.current, false)
})

test('Sign Up keeps its existing registration payload and success flow', () => {
  assert.match(signUpSource, /if \(!acquireSubmissionLock\(submitting\)\) return/)
  assert.match(signUpSource, /await register\(\{\s*name: values\.get\('name'\)\.trim\(\),\s*email: values\.get\('email'\)\.trim\(\),\s*password,\s*username: values\.get\('username'\)\.trim\(\),\s*mobile: values\.get\('mobile'\)\.trim\(\),\s*account: values\.get\('account'\),\s*\}\)/)
  assert.match(signUpSource, /form\.reset\(\)\s*setSuccess\(true\)/)
  assert.match(signUpSource, /window\.location\.assign\('\/signin'\)/)
  assert.match(signUpSource, /releaseSubmissionLock\(submitting\)\s*setPending\(false\)/)
})
