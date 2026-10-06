import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import vm from 'node:vm'

const legacyMapSource = await readFile(fileURLToPath(new URL('../../../map_manager.js', import.meta.url)), 'utf8')

function setupLegacyMap(rows) {
  const windowListeners = new Map()
  const parentMessages = []
  const viewCalls = []
  const elements = new Map()
  const parentWindow = { postMessage: (message) => parentMessages.push(message) }

  function element(id) {
    if (elements.has(id)) return elements.get(id)
    const listeners = new Map()
    const item = {
      id,
      clicks: 0,
      classList: { remove() {} },
      dataset: {},
      children: [],
      addEventListener(type, callback) {
        const callbacks = listeners.get(type) ?? []
        callbacks.push(callback)
        listeners.set(type, callbacks)
      },
      click() {
        this.clicks += 1
        for (const callback of listeners.get('click') ?? []) callback({ target: this, currentTarget: this })
      },
      appendChild(child) { this.children.push(child) },
    }
    elements.set(id, item)
    return item
  }

  class ArcMap { add(layer) { this.layer = layer } }
  class MapView {
    constructor(options) {
      this.options = options
      this.ui = { add() {} }
      this.when = () => Promise.resolve(this)
      this.goTo = (options) => { viewCalls.push(options); return Promise.resolve() }
    }
  }
  class Graphic { constructor(options) { Object.assign(this, options) } }
  class Stub { constructor(options) { Object.assign(this, options) } }
  class SketchStub extends Stub { on() {} }
  const projection = { load: () => Promise.resolve(), project: (point) => point }
  const document = {
    body: { dataset: {} },
    getElementById: element,
    createElement: (tag) => ({ tag, classList: { add() {}, remove() {} } }),
    addEventListener() {},
  }
  const window = {
    Map,
    location: { origin: 'http://localhost:5173' },
    parent: parentWindow,
    addEventListener(type, callback) { windowListeners.set(type, callback) },
    postMessage(message) { parentMessages.push(message) },
    geometryEngine: null,
    projection: null,
  }
  const context = {
    window, document, console: { log() {}, error() {} },
    localStorage: { getItem: () => 'test-session', setItem() {}, removeItem() {} },
    sessionStorage: { getItem: () => 'test-session' },
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: rows }) }),
    URL: { createObjectURL: () => 'blob:test-map' },
    Blob,
    alert() {},
    require(_dependencies, callback) {
      callback(ArcMap, MapView, Stub, SketchStub, Stub, Stub, Stub, {}, projection, {}, {}, {}, {}, Graphic, Stub, Stub, Stub, Stub)
    },
  }
  vm.runInNewContext(legacyMapSource, context, { filename: 'map_manager.js' })
  return { window, document, elements, parentMessages, viewCalls, windowListeners }
}

async function flushAsyncTasks() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

test('map focus resolves duplicate parcel names by uuid/id and uses each row geometry', async () => {
  const firstGeometry = { type: 'Polygon', coordinates: [[[1, 1], [2, 1], [2, 2], [1, 1]]] }
  const secondGeometry = { type: 'Polygon', coordinates: [[[21, -3], [22, -3], [22, -2], [21, -3]]] }
  const map = setupLegacyMap([
    { id: 11, uuid: 'parcel-a', parcel_name: 'Same name', geojson: JSON.stringify(firstGeometry) },
    { id: 22, uuid: 'parcel-b', parcel_name: 'Same name', geojson: JSON.stringify(secondGeometry) },
  ])
  const onMessage = map.windowListeners.get('message')
  onMessage({ source: map.window.parent, origin: map.window.location.origin, data: { type: 'tany:main-map-focus', id: 22, uuid: 'parcel-b' } })
  await flushAsyncTasks()
  assert.equal(map.viewCalls.length, 1)
  assert.equal(map.viewCalls[0].zoom, 18)
  assert.equal(map.viewCalls[0].target.attributes.uuid, 'parcel-b')
  assert.deepEqual(JSON.parse(JSON.stringify(map.viewCalls[0].target.geometry.rings)), secondGeometry.coordinates)
  assert.ok(map.parentMessages.some((message) => message.type === 'tany:map-focus-result' && message.success))

  onMessage({ source: map.window.parent, origin: map.window.location.origin, data: { type: 'tany:main-map-focus', id: 11, uuid: 'unknown-uuid' } })
  await flushAsyncTasks()
  assert.equal(map.viewCalls.length, 2)
  assert.equal(map.viewCalls[1].target.attributes.id, 11)
})

test('map action bridge opens Add drawer and delegates Export to its legacy control', () => {
  const map = setupLegacyMap([])
  const onMessage = map.windowListeners.get('message')
  const send = (action) => onMessage({ source: map.window.parent, origin: map.window.location.origin, data: { type: 'tany:main-map-action', action } })
  send('add')
  assert.equal(map.document.body.dataset.mapDrawer, 'add')
  assert.equal(map.elements.get('addparcel').clicks, 1)
  send('export')
  assert.equal(map.elements.get('export_kml').clicks, 1)
  map.elements.get('closeBtn').click()
  assert.equal(map.document.body.dataset.mapDrawer, undefined)
})
