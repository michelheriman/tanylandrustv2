import { useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { mountAdminParcelMap, parseAdminParcelMapGeometry } from './adminParcelMap.js'

export default function AdminParcelMap({ geojson }) {
  const host = useRef(null)
  const geometry = useMemo(() => parseAdminParcelMapGeometry(geojson), [geojson])
  const [failedGeometry, setFailedGeometry] = useState(null)

  useEffect(() => {
    if (!geometry || !host.current) return undefined

    let cancelled = false
    let mountedMap = null
    import('leaflet').then(({ default: L }) => {
      if (cancelled || !host.current) return
      mountedMap = mountAdminParcelMap(L, host.current, geometry)
      if (!mountedMap) {
        setFailedGeometry(geometry)
        return
      }
      mountedMap.map.invalidateSize()
      mountedMap.map.fitBounds(mountedMap.bounds, { padding: [20, 20], maxZoom: 17 })
    }).catch(() => {
      if (!cancelled) setFailedGeometry(geometry)
    })

    return () => {
      cancelled = true
      mountedMap?.map.remove()
    }
  }, [geometry])

  if (!geometry || failedGeometry === geometry) {
    return <p className="admin-parcel-map-unavailable" role="status">Carte indisponible</p>
  }

  return <div className="admin-parcel-map" ref={host} role="img" aria-label="Map showing the parcel boundary" />
}
