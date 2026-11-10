import { ApiError } from './client.js'

export const PARCEL_DELETE_REASON_MAX_LENGTH = 1000

const ownerParcelRightsFlights = new WeakMap()

function validateDeleteRequest(request, id) {
  if (typeof request !== 'function' || id === undefined || id === null || String(id).trim() === '') {
    throw new ApiError('protocol', 'La référence de parcelle est invalide.')
  }
}

async function deleteParcel(request, id, role, { confirmed = false, reason } = {}) {
  validateDeleteRequest(request, id)
  if (!confirmed) return null

  const normalizedId = String(id)
  const options = { method: 'POST' }
  if (role === 'admin') {
    if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > PARCEL_DELETE_REASON_MAX_LENGTH) {
      throw new ApiError('validation', 'Une raison de 1 à 1000 caractères est requise.', 400)
    }
    options.body = JSON.stringify({ reason: reason.trim() })
  }

  const path = role === 'admin'
    ? `/admin/parcels/${encodeURIComponent(normalizedId)}/delete`
    : `/parcels/${encodeURIComponent(normalizedId)}/delete`
  const response = await request(path, options)
  // The local Flask route currently returns the acknowledgement fields next
  // to `success`; keep accepting the older nested `{data: {...}}` envelope too.
  const data = response?.data ?? response
  // The server's explicit success flag and requested row ID are the
  // acknowledgement needed by the UI. Archive metadata is intentionally not
  // interpreted here: its representation must not turn a committed deletion
  // into a client-side failure.
  if (response?.success !== true || !data || typeof data !== 'object' || Array.isArray(data) ||
      data.parcel_id == null || String(data.parcel_id) !== normalizedId) {
    throw new ApiError('protocol', 'Le serveur a renvoyé un accusé de suppression invalide.')
  }

  // Keep only the small acknowledgement needed by the UI; never retain an archive snapshot.
  return { parcelId: normalizedId }
}

export function deleteAdminParcel(request, id, reason, options = {}) {
  return deleteParcel(request, id, 'admin', { ...options, reason })
}

export function deleteOwnedParcel(request, id, options = {}) {
  return deleteParcel(request, id, 'pro', options)
}

export function loadOwnerParcelDeletionRights(request) {
  if (typeof request !== 'function') throw new ApiError('protocol', 'La lecture des droits est indisponible.')

  const activeFlight = ownerParcelRightsFlights.get(request)
  if (activeFlight) return activeFlight

  // React StrictMode replays mount effects in development. Share only that
  // in-flight read for the same authenticated request function; a later page
  // load, focus, or retry must fetch current rights again.
  const flight = Promise.resolve()
    .then(() => request('/account/parcel-rights'))
    .then((response) => {
      const data = response?.data
      const expected = data?.code === 'free' ? { limit: 2, canDelete: false }
        : data?.code === 'pro' ? { limit: 20, canDelete: true }
          : null
      if (response?.success !== true || !data || !expected ||
          data.parcel_limit !== expected.limit ||
          data.can_delete_owned_parcels !== expected.canDelete) {
        throw new ApiError('protocol', 'Le serveur a renvoyé des droits de parcelle invalides.')
      }
      return {
        plan: data.code,
        parcelLimit: data.parcel_limit,
        canDeleteOwnedParcels: data.can_delete_owned_parcels,
      }
    })

  ownerParcelRightsFlights.set(request, flight)
  const clearFlight = () => {
    if (ownerParcelRightsFlights.get(request) === flight) ownerParcelRightsFlights.delete(request)
  }
  void flight.then(clearFlight, clearFlight)
  return flight
}

export function effectiveOfferSummary(rights, lang = 'en') {
  if (rights?.status !== 'ready' || !['free', 'pro'].includes(rights.plan) ||
      !Number.isSafeInteger(rights.parcelLimit) || rights.parcelLimit < 1) return null
  const plan = rights.plan === 'pro' ? 'Pro' : 'Free'
  if (lang === 'fr') {
    const deleteRight = rights.canDeleteOwnedParcels === true
      ? 'suppression des parcelles personnelles autoris\u00e9e'
      : 'suppression des parcelles personnelles indisponible'
    return 'Offre effective (souscriptions actuelles) : ' + plan + ' \u2014 limite ' + rights.parcelLimit + ' parcelles \u2014 ' + deleteRight + '.'
  }
  const deleteRight = rights.canDeleteOwnedParcels === true
    ? 'deletion of owned parcels allowed'
    : 'deletion of owned parcels unavailable'
  return 'Effective offer (current subscriptions): ' + plan + ' \u2014 ' + rights.parcelLimit + '-parcel limit \u2014 ' + deleteRight + '.'
}

export function canShowOwnerParcelDelete({ rights, parcelId, deniedParcelIds }) {
  return rights?.status === 'ready' &&
    rights.canDeleteOwnedParcels === true && !deniedParcelIds?.has(String(parcelId))
}

export function markOwnerParcelDeleteDenied(deniedParcelIds, parcelId, status) {
  if (Number(status) !== 403) return deniedParcelIds
  const next = new Set(deniedParcelIds || [])
  next.add(String(parcelId))
  return next
}

export function parcelDeletionErrorMessage(error, lang = 'en', role = 'pro') {
  const status = Number(error?.status) || 0
  const french = lang === 'fr'
  if (status === 401 || error?.kind === 'auth') {
    return french ? 'Votre session a expiré. Reconnectez-vous puis réessayez.' : 'Your session expired. Sign in again and retry.'
  }
  if (status === 403) {
    return role === 'admin'
      ? (french ? 'Suppression refusée : un accès administrateur actif est requis.' : 'Deletion refused: active administrator access is required.')
      : (french ? 'Suppression refusée : une offre Pro effective avec le droit de suppression est requise.' : 'Deletion refused: an effective Pro offer with deletion rights is required.')
  }
  if (status === 404) {
    if (role === 'admin') return french ? 'Cette parcelle n’existe plus ou est introuvable.' : 'This parcel no longer exists or could not be found.'
    return french ? 'Cette parcelle est introuvable ou ne vous appartient pas.' : 'This parcel was not found or does not belong to you.'
  }
  if (status === 409) {
    return french
      ? 'Suppression bloquée : des références ou l’état de la parcelle nécessitent une vérification.'
      : 'Deletion blocked: parcel references or state need review.'
  }
  if (status >= 500 || error?.kind === 'server' || error?.kind === 'network') {
    return french ? 'Le serveur n’a pas pu supprimer la parcelle. Réessayez plus tard.' : 'The server could not delete this parcel. Try again later.'
  }
  if (error?.kind === 'validation') return french ? 'Saisissez une raison de 1 à 1000 caractères.' : 'Enter a reason from 1 to 1000 characters.'
  return french ? 'La suppression n’a pas abouti. Vérifiez les informations puis réessayez.' : 'Deletion could not be completed. Check the details and try again.'
}
