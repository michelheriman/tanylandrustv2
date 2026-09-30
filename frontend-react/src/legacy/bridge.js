// Loaded before unchanged legacy scripts in the embedded pages.
// Their API calls use the React session through a same-origin message bridge.
(() => {
  const getItem = Storage.prototype.getItem
  const originalFetch = window.fetch.bind(window)
  const apiOrigins = new Set([
    window.location.origin,
    'http://127.0.0.1:5000',
    'http://localhost:5000',
    'https://mtk.pythonanywhere.com',
  ])
  let nextId = 0
  const pending = new Map()

  function hasSession() {
    try { return Boolean(JSON.parse(getItem.call(localStorage, 'tany.auth.session'))?.accessToken) }
    catch { return false }
  }

  Storage.prototype.getItem = function (key) {
    if (this === localStorage && (key === 'auth_token' || key === 'refresh_token')) {
      return hasSession() ? 'react-managed-session' : null
    }
    return getItem.call(this, key)
  }

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.data?.type !== 'tany:legacy-api-result') return
    const resolve = pending.get(event.data.id)
    if (!resolve) return
    pending.delete(event.data.id)
    resolve(new Response(event.data.binary ? event.data.body : JSON.stringify(event.data.data), {
      status: event.data.status,
      headers: { 'Content-Type': event.data.binary ? 'application/vnd.google-earth.kml+xml' : 'application/json' },
    }))
  })

  window.fetch = (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.href)
    if (!(url.pathname.startsWith('/api/') || url.pathname === '/export/kml') ||
        !apiOrigins.has(url.origin) ||
        window.top === window) return originalFetch(input, init)

    const id = ++nextId
    const body = init.body instanceof FormData
      ? { kind: 'form', entries: [...init.body.entries()] }
      : { kind: 'plain', value: init.body ?? null }
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        pending.delete(id)
        reject(new TypeError('The API request timed out.'))
      }, 30000)
      pending.set(id, (response) => { window.clearTimeout(timer); resolve(response) })
      window.top.postMessage({ type: 'tany:legacy-api', id, path: url.pathname === '/export/kml' ? '/export/kml' : `${url.pathname.slice(4)}${url.search}`, method: init.method || 'GET', body }, window.location.origin)
    })
  }
})()
