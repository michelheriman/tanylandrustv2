import { useEffect, useRef, useState } from 'react'
import { parcelsToFeatureCollection, parseParcelGeometry } from './parcelMapData.js'

const ARCGIS_SCRIPT = 'https://js.arcgis.com/4.31/'
const ARCGIS_CSS = 'https://js.arcgis.com/4.31/esri/themes/light/main.css'
const MODULES = [
  'esri/Map', 'esri/views/MapView', 'esri/layers/GraphicsLayer', 'esri/widgets/Sketch',
  'esri/widgets/Expand', 'esri/widgets/Search', 'esri/geometry/SpatialReference',
  'esri/geometry/operators/centroidOperator', 'esri/geometry/projection',
  'esri/geometry/geometryEngine', 'esri/Graphic', 'esri/layers/GeoJSONLayer',
  'esri/renderers/SimpleRenderer', 'esri/symbols/SimpleFillSymbol',
  'esri/layers/support/LabelClass', 'esri/geometry/Polygon',
]

let arcgisReady
function loadArcGIS() {
  if (arcgisReady) return arcgisReady
  arcgisReady = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${ARCGIS_CSS}"]`)) {
      const style = document.createElement('link')
      style.rel = 'stylesheet'
      style.href = ARCGIS_CSS
      document.head.appendChild(style)
    }
    const loadModules = () => {
      if (typeof window.require !== 'function') { reject(new Error('ArcGIS API AMD loader is unavailable.')); return }
      window.require(MODULES, (...modules) => resolve(Object.fromEntries(MODULES.map((name, index) => [name, modules[index]]))), reject)
    }
    if (typeof window.require === 'function') { loadModules(); return }
    const existing = document.querySelector(`script[src="${ARCGIS_SCRIPT}"]`)
    const script = existing ?? document.createElement('script')
    script.src = ARCGIS_SCRIPT
    script.async = true
    script.addEventListener('load', loadModules, { once: true })
    script.addEventListener('error', () => reject(new Error('ArcGIS API failed to load.')), { once: true })
    if (!existing) document.head.appendChild(script)
  }).catch((error) => { arcgisReady = null; throw error })
  return arcgisReady
}

function polygonFromGeoJSON(Polygon, value) {
  const geo = parseParcelGeometry(value)
  if (!geo) return null
  const rings = geo.type === 'MultiPolygon' ? geo.coordinates.flat() : geo.coordinates
  return new Polygon({ rings, spatialReference: { wkid: 4326 } })
}

export default function ParcelMap({ parcels, selectedParcel, focusVersion, onSelectParcel, onGeometryComplete, resetDrawingKey, lang, onError }) {
  const container = useRef(null)
  const mapRef = useRef(null)
  const viewRef = useRef(null)
  const layerRef = useRef(null)
  const focusLayerRef = useRef(null)
  const sketchLayerRef = useRef(null)
  const modulesRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const callbacksRef = useRef({ onGeometryComplete, onSelectParcel, onError })
  useEffect(() => { callbacksRef.current = { onGeometryComplete, onSelectParcel, onError } }, [onGeometryComplete, onSelectParcel, onError])

  useEffect(() => {
    let live = true
    let clickHandle
    let sketchHandle
    let view
    loadArcGIS().then(async (modules) => {
      if (!live || !container.current) return
      modulesRef.current = modules
      const Map = modules['esri/Map']
      const MapView = modules['esri/views/MapView']
      const GraphicsLayer = modules['esri/layers/GraphicsLayer']
      const Sketch = modules['esri/widgets/Sketch']
      const Expand = modules['esri/widgets/Expand']
      const Search = modules['esri/widgets/Search']
      const map = new Map({ basemap: 'satellite' })
      view = new MapView({ container: container.current, map, center: [35, 0.5], zoom: 4 })
      const focusLayer = new GraphicsLayer()
      const sketchLayer = new GraphicsLayer()
      map.addMany([focusLayer, sketchLayer])
      mapRef.current = map
      viewRef.current = view
      focusLayerRef.current = focusLayer
      sketchLayerRef.current = sketchLayer

      const sketch = new Sketch({ layer: sketchLayer, view, creationMode: 'update', availableCreateTools: ['polygon'] })
      const sketchExpand = new Expand({ expandIcon: 'pencil-mark-plus', view, content: sketch, expandTooltip: lang === 'fr' ? 'Dessiner une parcelle' : 'Draw a parcel' })
      view.ui.add(sketchExpand, 'top-right')
      view.ui.add(new Search({ view }), { position: 'top-left' })
      sketchHandle = sketch.on('create', async (event) => {
        if (event.state !== 'complete' || !event.graphic?.geometry) return
        try {
          const projection = modules['esri/geometry/projection']
          const SpatialReference = modules['esri/geometry/SpatialReference']
          await projection.load()
          const geometry = projection.project(event.graphic.geometry, new SpatialReference({ wkid: 4326 }))
          if (!geometry) throw new Error('The parcel boundary could not be projected to WGS84.')
          const centroid = modules['esri/geometry/operators/centroidOperator'].execute(geometry)
          const areaHa = modules['esri/geometry/geometryEngine'].geodesicArea(geometry, 'hectares')
          callbacksRef.current.onGeometryComplete({ geometry: geometry.toJSON(), centroid, areaHa })
        } catch (error) { callbacksRef.current.onError?.(error) }
      })
      clickHandle = view.on('click', async (event) => {
        const hit = await view.hitTest(event)
        const graphic = hit.results?.map((result) => result.graphic).find((item) => item?.layer === layerRef.current)
        const id = graphic?.attributes?.id ?? graphic?.attributes?.uuid
        if (id != null) callbacksRef.current.onSelectParcel(id)
      })
      await view.when()
      if (live) setReady(true)
    }).catch((error) => {
      if (!live) return
      setLoadError(error)
      setReady(false)
      onError?.(error)
    })
    return () => {
      live = false
      clickHandle?.remove()
      sketchHandle?.remove()
      view?.destroy()
      mapRef.current = null
      viewRef.current = null
      layerRef.current = null
      focusLayerRef.current = null
      sketchLayerRef.current = null
    }
  // ArcGIS controls are initialized once; event callbacks are read from the latest props below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!ready || !mapRef.current) return undefined
    const collection = parcelsToFeatureCollection(parcels)
    // ArcGIS cannot build a useful 2D layer from the empty collection shown
    // while Marketplace is loading or after an API error. Wait for real features.
    if (collection.features.length === 0) {
      const previous = layerRef.current
      layerRef.current = null
      if (previous) mapRef.current.remove(previous)
      return undefined
    }
    const blob = new Blob([JSON.stringify(collection)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    let live = true
    const modules = modulesRef.current
    const GeoJSONLayer = modules['esri/layers/GeoJSONLayer']
    const SimpleRenderer = modules['esri/renderers/SimpleRenderer']
    const SimpleFillSymbol = modules['esri/symbols/SimpleFillSymbol']
    const LabelClass = modules['esri/layers/support/LabelClass']
    const layer = new GeoJSONLayer({
      url,
      renderer: new SimpleRenderer({ symbol: new SimpleFillSymbol({ color: [0, 255, 0, 0.2], outline: { color: [0, 0, 0, 1], width: 1 } }) }),
      labelingInfo: [new LabelClass({
        labelExpressionInfo: { expression: '$feature.parcel_name' },
        symbol: { type: 'text', color: 'blue', haloColor: 'white', haloSize: '1px', font: { size: 12, family: 'Arial', weight: 'bold' } },
        labelPlacement: 'above-center',
      })],
      outFields: ['*'],
    })
    mapRef.current.add(layer)
    mapRef.current.reorder(sketchLayerRef.current, mapRef.current.layers.length - 1)
    mapRef.current.reorder(focusLayerRef.current, mapRef.current.layers.length - 2)
    const previous = layerRef.current
    layerRef.current = layer
    if (previous) mapRef.current.remove(previous)
    layer.when().catch((error) => { if (live) callbacksRef.current.onError?.(error) })
    return () => {
      live = false
      if (layerRef.current === layer) layerRef.current = null
      mapRef.current?.remove(layer)
      URL.revokeObjectURL(url)
    }
  }, [parcels, ready])

  useEffect(() => {
    if (!ready || !viewRef.current || !focusLayerRef.current) return
    const modules = modulesRef.current
    const Graphic = modules['esri/Graphic']
    const SimpleFillSymbol = modules['esri/symbols/SimpleFillSymbol']
    const geometry = selectedParcel && polygonFromGeoJSON(modules['esri/geometry/Polygon'], selectedParcel.geojson)
    focusLayerRef.current.removeAll()
    if (!geometry) {
      if (selectedParcel) callbacksRef.current.onError?.(new Error(lang === 'fr' ? 'La géométrie de cette parcelle est invalide.' : 'This parcel has no valid polygon geometry.'))
      return
    }
    const graphic = new Graphic({ geometry, attributes: selectedParcel })
    focusLayerRef.current.add(new Graphic({
      geometry,
      attributes: selectedParcel,
      symbol: new SimpleFillSymbol({ color: [0, 255, 0, 0.2], outline: { color: [0, 0, 0, 1], width: 1 } }),
    }))
    viewRef.current.goTo({ target: graphic, zoom: 18 }).catch((error) => callbacksRef.current.onError?.(error))
  }, [selectedParcel, ready, focusVersion, lang])

  useEffect(() => {
    if (resetDrawingKey == null) return
    sketchLayerRef.current?.removeAll()
  }, [resetDrawingKey])

  return <div className="main-map-canvas" role="application" aria-label={lang === 'fr' ? 'Carte des parcelles' : 'Parcel map'}>
    <div className="main-map-host" ref={container} />
    {!ready && !loadError && <p className="main-map-loading" role="status">{lang === 'fr' ? 'Chargement de la carte…' : 'Loading map…'}</p>}
    {loadError && <p className="main-map-load-error" role="alert">{lang === 'fr' ? 'La carte ArcGIS est indisponible. Vérifiez la connexion au service cartographique.' : 'The ArcGIS map is unavailable. Check the map service connection.'}</p>}
  </div>
}
