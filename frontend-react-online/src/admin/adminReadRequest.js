/**
 * Coalesce identical in-flight admin reads for one authenticated UI session.
 * This is deliberately not a response cache: settled responses are discarded,
 * mutations are never coalesced, and the caller can clear pending work when
 * the session changes.
 */
export function createAdminReadRequest(request, sessionScope = null) {
  if (typeof request !== 'function') throw new TypeError('An authenticated request function is required')

  const inFlight = new Map()
  const adminRequest = (path, options = {}) => {
    const method = String(options.method ?? 'GET').toUpperCase()
    if (method !== 'GET') return request(path, options)

    const key = `${method}:${path}`
    const existing = inFlight.get(key)
    if (existing) return existing

    let flight
    flight = Promise.resolve()
      .then(() => request(path, options))
      .finally(() => {
        if (inFlight.get(key) === flight) inFlight.delete(key)
      })
    inFlight.set(key, flight)
    return flight
  }

  adminRequest.clearInflight = () => inFlight.clear()
  adminRequest.sessionScope = sessionScope
  return adminRequest
}
