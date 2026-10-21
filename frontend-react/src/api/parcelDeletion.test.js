import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from './client.js'
import {
  canShowOwnerParcelDelete,
  deleteAdminParcel,
  deleteOwnedParcel,
  effectiveOfferSummary,
  loadOwnerParcelDeletionRights,
  markOwnerParcelDeleteDenied,
  parcelDeletionErrorMessage,
} from './parcelDeletion.js'
import { readFile } from 'node:fs/promises'

const mainSource = await readFile(new URL('../pages/Main.jsx', import.meta.url), 'utf8')

const success = (parcelId, actorRole) => ({
  success: true,
  data: { parcel_id: String(parcelId), archive_id: '71', actor_role: actorRole, deleted_at: '2026-10-20T12:00:00Z' },
})

test('admin deletion is not sent until explicitly confirmed and requires a bounded reason', async () => {
  const calls = []
  const request = async (...args) => { calls.push(args); return success('12', 'admin') }
  assert.equal(await deleteAdminParcel(request, '12', '', { confirmed: false }), null)
  await assert.rejects(deleteAdminParcel(request, '12', '', { confirmed: true }), (error) => error.status === 400)
  await assert.rejects(deleteAdminParcel(request, '12', 'x'.repeat(1001), { confirmed: true }), (error) => error.status === 400)
  assert.deepEqual(calls, [])

  assert.deepEqual(await deleteAdminParcel(request, '12', ' reviewed ', { confirmed: true }), { parcelId: '12' })
  assert.deepEqual(calls, [[
    '/admin/parcels/12/delete',
    { method: 'POST', body: JSON.stringify({ reason: 'reviewed' }) },
  ]])
})

test('owner cancellation sends nothing and confirmed deletion relies on the server offer check', async () => {
  const calls = []
  const request = async (...args) => { calls.push(args); return success('44', 'pro') }
  assert.equal(await deleteOwnedParcel(request, '44', { confirmed: false }), null)
  assert.deepEqual(calls, [])
  assert.deepEqual(await deleteOwnedParcel(request, '44', { confirmed: true }), { parcelId: '44' })
  assert.deepEqual(calls, [['/parcels/44/delete', { method: 'POST' }]])
})

test('deletion helper returns only an acknowledgement, never stores response snapshot fields', async () => {
  const result = await deleteOwnedParcel(async () => ({
    success: true,
    data: {
      parcel_id: '9', archive_id: '71', actor_role: 'pro', deleted_at: '2026-10-20T12:00:00Z',
      parcel_snapshot: { private: 'must not enter UI state' },
    },
  }), '9', { confirmed: true })
  assert.deepEqual(result, { parcelId: '9' })
  assert.equal(Object.hasOwn(result, 'parcel_snapshot'), false)
})

test('HTTP refusals produce actionable, non-sensitive messages', () => {
  assert.match(parcelDeletionErrorMessage(new ApiError('auth', '', 401), 'fr'), /session a expiré/i)
  assert.match(parcelDeletionErrorMessage(new ApiError('request', '', 403), 'fr', 'pro'), /offre Pro effective/i)
  assert.match(parcelDeletionErrorMessage(new ApiError('request', '', 404), 'fr'), /introuvable/i)
  assert.match(parcelDeletionErrorMessage(new ApiError('request', '', 404), 'fr', 'admin'), /n’existe plus/i)
  assert.match(parcelDeletionErrorMessage(new ApiError('request', '', 409, { code: 'legacy_references_require_review' }), 'fr'), /nécessitent une vérification/i)
  assert.doesNotMatch(parcelDeletionErrorMessage(new ApiError('request', '', 409), 'fr'), /must not enter UI state/)
})

test('owner deletion rights are read fresh from the local effective-rights endpoint', async () => {
  const calls = []
  const pro = await loadOwnerParcelDeletionRights(async (path) => {
    calls.push(path)
    return { success: true, data: { code: 'pro', parcel_limit: 20, can_delete_owned_parcels: true } }
  })
  assert.deepEqual(pro, { plan: 'pro', parcelLimit: 20, canDeleteOwnedParcels: true })
  assert.deepEqual(calls, ['/account/parcel-rights'])

  const free = await loadOwnerParcelDeletionRights(async () => ({
    success: true,
    // The server returns this Free result both for a Free account and for an expired Pro grant.
    data: { code: 'free', parcel_limit: 2, can_delete_owned_parcels: false },
  }))
  assert.deepEqual(free, { plan: 'free', parcelLimit: 2, canDeleteOwnedParcels: false })
  await assert.rejects(loadOwnerParcelDeletionRights(async () => ({
    success: true, data: { code: 'pro', parcel_limit: 20, can_delete_owned_parcels: false },
  })), (error) => error.kind === 'protocol')
})

test('owner delete stays hidden while rights load or fail, and outside local mode', () => {
  const parcelId = 5
  const activePro = { status: 'ready', plan: 'pro', canDeleteOwnedParcels: true }
  const free = { status: 'ready', plan: 'free', canDeleteOwnedParcels: false }
  assert.equal(canShowOwnerParcelDelete({ localBackend: true, rights: free, parcelId }), false)
  assert.equal(canShowOwnerParcelDelete({ localBackend: true, rights: activePro, parcelId }), true)
  assert.equal(canShowOwnerParcelDelete({ localBackend: true, rights: { status: 'loading', canDeleteOwnedParcels: false }, parcelId }), false)
  assert.equal(canShowOwnerParcelDelete({ localBackend: true, rights: { status: 'error', canDeleteOwnedParcels: false }, parcelId }), false)
  assert.equal(canShowOwnerParcelDelete({ localBackend: false, rights: activePro, parcelId }), false)
})

test('owner offer summary is sourced from current server rights and stays hidden during load or failure', () => {
  const pro = { status: 'ready', plan: 'pro', parcelLimit: 20, canDeleteOwnedParcels: true }
  const freeAfterExpiry = { status: 'ready', plan: 'free', parcelLimit: 2, canDeleteOwnedParcels: false }
  assert.ok(effectiveOfferSummary(pro, 'fr').includes('Offre effective (souscriptions actuelles) : Pro'))
  assert.ok(effectiveOfferSummary(pro, 'fr').includes('20 parcelles'))
  assert.match(effectiveOfferSummary(freeAfterExpiry), /Effective offer \(current subscriptions\): Free.*2-parcel limit/i)
  assert.equal(canShowOwnerParcelDelete({ localBackend: true, rights: freeAfterExpiry, parcelId: 5 }), false)
  assert.equal(effectiveOfferSummary({ ...pro, status: 'loading' }), null)
  assert.equal(effectiveOfferSummary({ ...freeAfterExpiry, status: 'error' }), null)
})

test('a 403 after a visible owner delete action hides that parcel action and triggers a fresh read', () => {
  const parcelId = 5
  const rights = { status: 'ready', plan: 'pro', canDeleteOwnedParcels: true }
  assert.equal(canShowOwnerParcelDelete({ localBackend: true, rights, parcelId }), true)
  const denied = markOwnerParcelDeleteDenied(new Set(), parcelId, 403)
  assert.equal(canShowOwnerParcelDelete({ localBackend: true, rights, parcelId, deniedParcelIds: denied }), false)
  assert.equal(canShowOwnerParcelDelete({ localBackend: true, rights, parcelId: 6, deniedParcelIds: denied }), true)
  assert.match(mainSource, /markOwnerParcelDeleteDenied\(current, parcelId, failure\.status\)/)
  assert.match(mainSource, /setReloadKey\(\(key\) => key \+ 1\)/)
  assert.match(mainSource, /showOwnerDelete\(row\.id\) && <div className="main-parcel-delete-wrap"/)
})
