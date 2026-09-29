import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import vm from 'node:vm'
import { createAuthService } from '../auth/authService.js'

const marketScript = await readFile(fileURLToPath(new URL('../../../main.js', import.meta.url)), 'utf8')

function bootMarket(responseOrError) {
  const requests = []
  const nodes = []
  const listeners = {}
  const mapCalls = []
  const parcelList = {
    attrs: {}, children: [],
    setAttribute(name, value) { this.attrs[name] = value },
    removeAttribute(name) { delete this.attrs[name] },
    set innerHTML(value) { this.children = []; this.html = value },
    get innerHTML() { return this.html },
    replaceChildren(...children) { this.children = children },
    append(...children) { this.children.push(...children) },
    appendChild(child) { this.children.push(child) },
  }
  const control = (value = '') => { const classNames = new Set(); return { value, disabled: false, attrs: {}, classNames,
    addEventListener(name, fn) { listeners[`control:${this.id}:${name}`] = fn },
    setAttribute(name, attrValue) { this.attrs[name] = attrValue },
    classList: { add(name) { classNames.add(name) }, remove(name) { classNames.delete(name) } },
  } }
  const marketSearch = control('')
  marketSearch.id = 'marketSearch'
  const marketNameSort = control('')
  marketNameSort.id = 'marketNameSort'
  const marketDateSort = control('')
  marketDateSort.id = 'marketDateSort'
  const elements = { parcelList, marketSearch, marketNameSort, marketDateSort }
  const document = {
    getElementById(id) { return elements[id] ?? null },
    createElement(tag) {
      const zoomButton = { addEventListener(name, fn) { this[name] = fn } }
      const node = { tag, attrs: {}, children: [], setAttribute(k, v) { this.attrs[k] = v }, addEventListener(name, fn) { this[name] = fn }, querySelector(selector) { return selector === '[data-action="zoom"]' ? zoomButton : null }, append(...items) { this.children.push(...items) }, appendChild(item) { this.children.push(item) } }
      nodes.push(node)
      return node
    },
  }
  class MapView {
    constructor() { this.ui = { add() {} } }
    goTo(target) { mapCalls.push(target); return Promise.resolve() }
    when(callback) { queueMicrotask(callback) }
  }
  class GraphicsLayer { constructor() { this.graphics = { items: [] } } add(graphic) { this.graphics.items.push(graphic) } }
  class Map { constructor() {} }
  class Widget { constructor() {} }
  class Graphic { constructor(options) { Object.assign(this, options) } }
  const context = {
    document,
    window: {},
    fetch: async (...args) => {
      requests.push(args)
      if (responseOrError instanceof Error) throw responseOrError
      return responseOrError
    },
    Intl, URL, console, setTimeout, clearTimeout,
    require: (_modules, callback) => callback(Map, MapView, Graphic, GraphicsLayer, Widget, Widget, Widget, Widget),
  }
  vm.runInNewContext(marketScript, context, { filename: 'main.js' })
  return new Promise((resolve) => setTimeout(() => resolve({ parcelList, requests, nodes, context, elements, listeners, mapCalls }), 0))
}

const parcelGeometry = JSON.stringify({ type: 'Polygon', coordinates: [[[47.5, -18.9], [47.6, -18.9], [47.6, -18.8], [47.5, -18.9]]] })
const marketRows = [
  { id: 1, uuid: 'alpha-id', parcel_name: 'Alpha plot', location_name: 'North', price_m2: 12, updated_at: '2025-01-02', geojson: parcelGeometry },
  { id: 2, uuid: 'beta-id', parcel_name: 'Beta land', location_name: 'South', price_m2: 25, updated_at: '2025-02-02', geojson: parcelGeometry },
]

test('marketplace requests the relative bridged URL and renders the successful response', async () => {
  const run = await bootMarket({ ok: true, status: 200, json: async () => ({ success: true, data: [] }) })
  assert.equal(run.requests[0][0], '/api/market')
  assert.match(run.parcelList.children[0].textContent, /No parcels are currently available/)
  assert.equal(run.parcelList.attrs['aria-busy'], undefined)
})

test('marketplace 401 renders a retryable error and never displays fallback parcels', async () => {
  const run = await bootMarket({ ok: false, status: 401, json: async () => ({ success: false }) })
  assert.equal(run.requests[0][0], '/api/market')
  assert.match(run.parcelList.children[0].textContent, /session has expired/i)
  assert.equal(run.parcelList.children[0].attrs.role, 'alert')
  assert.equal(run.parcelList.children[1].tag, 'button')
  assert.equal(run.parcelList.children[1].textContent, 'Retry')
  assert.equal(run.context.window.graphicsLayer.graphics.items.length, 0)
})

test('malformed marketplace data renders an error rather than an empty state', async () => {
  const run = await bootMarket({ ok: true, status: 200, json: async () => ({ success: true, data: [{ id: 1, geojson: '{' }] }) })
  assert.match(run.parcelList.children[0].textContent, /invalid parcel geometry/i)
  assert.equal(run.parcelList.children[0].attrs.role, 'alert')
  assert.equal(run.parcelList.children[1].textContent, 'Retry')
})

test('marketplace network failure renders a retryable error', async () => {
  const run = await bootMarket(new TypeError('Failed to fetch'))
  assert.match(run.parcelList.children[0].textContent, /check your connection and retry/i)
  assert.equal(run.parcelList.children[1].textContent, 'Retry')
})

test('marketplace search and sorting filter real rows; card actions retain map and legacy destinations', async () => {
  const run = await bootMarket({ ok: true, status: 200, json: async () => ({ success: true, data: marketRows }) })
  assert.equal(run.parcelList.children.length, 2)
  assert.match(run.parcelList.children[0].innerHTML, /Alpha plot/)
  assert.match(run.parcelList.children[0].innerHTML, /products_details\.html\?id=alpha-id/)
  assert.match(run.parcelList.children[0].innerHTML, /details_parcel\.html\?id=alpha-id/)

  run.elements.marketSearch.value = 'beta'
  run.listeners['control:marketSearch:input']()
  assert.equal(run.parcelList.children.length, 1)
  assert.match(run.parcelList.children[0].innerHTML, /Beta land/)

  run.elements.marketSearch.value = ''
  run.listeners['control:marketSearch:input']()
  run.listeners['control:marketNameSort:click']({ currentTarget: run.elements.marketNameSort })
  assert.match(run.parcelList.children[0].innerHTML, /Beta land/)
  run.listeners['control:marketDateSort:click']({ currentTarget: run.elements.marketDateSort })
  assert.match(run.parcelList.children[0].innerHTML, /Beta land/)

  run.parcelList.children[0].querySelector('[data-action="zoom"]').click()
  assert.equal(run.mapCalls.length, 1)
  assert.equal(run.mapCalls[0].zoom, 16)
  assert.equal(run.context.window.graphicsLayer.graphics.items.find((graphic) => graphic.attributes.parcelId === 2).attributes.uuid, 'beta-id')
})

test('React sends its current bearer token to /api/market for a valid session', async () => {
  const session = { accessToken: 'access-valid', refreshToken: 'refresh-valid', user: null }
  const calls = []
  const auth = createAuthService({
    storage: { read: () => session, write() {}, clear() {} },
    fetchImpl: async (path, options = {}) => {
      const token = new Headers(options.headers).get('Authorization')
      calls.push({ path, token })
      if (path === '/api/current_user') return Response.json({ success: true, data: { id: 1, email: 'market-test@example.test' } })
      if (path === '/api/market') return Response.json({ success: true, data: [] })
      throw new Error(`Unexpected mock request: ${path}`)
    },
  })
  await auth.restore()
  assert.deepEqual((await auth.request('/market')).data, [])
  assert.deepEqual(calls.map(({ path }) => path), ['/api/current_user', '/api/market'])
  assert.equal(calls[1].token, 'Bearer access-valid')
})

test('React session refreshes once when /api/market returns 401 for an expired access token', async () => {
  let session = { accessToken: 'access-old', refreshToken: 'refresh-old', user: null }
  const calls = []
  const storage = {
    read: () => session,
    write: (value) => { session = value },
    clear: () => { session = null },
  }
  const fetchImpl = async (path, options = {}) => {
    const token = new Headers(options.headers).get('Authorization')
    calls.push({ path, token })
    if (path === '/api/current_user') return Response.json({ success: true, data: { id: 1, email: 'market-test@example.test' } })
    if (path === '/api/market' && token === 'Bearer access-old') return Response.json({ success: false }, { status: 401 })
    if (path === '/api/refresh-token') return Response.json({ success: true, token: 'access-new', refresh_token: 'refresh-new' })
    if (path === '/api/market' && token === 'Bearer access-new') return Response.json({ success: true, data: [] })
    throw new Error(`Unexpected mock request: ${path}`)
  }
  const auth = createAuthService({ storage, fetchImpl })
  await auth.restore()
  const result = await auth.request('/market')
  assert.deepEqual(result.data, [])
  assert.deepEqual(calls.map(({ path }) => path), ['/api/current_user', '/api/market', '/api/refresh-token', '/api/market'])
  assert.equal(calls[1].token, 'Bearer access-old')
  assert.equal(calls[3].token, 'Bearer access-new')
  assert.equal(session.refreshToken, 'refresh-new')
})
