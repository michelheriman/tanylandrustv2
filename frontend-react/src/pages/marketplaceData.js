import { parseParcelGeometry } from './parcelMapData.js'
export { geoReportErrorMessage, geoReportFromResponse, geoReportLookupBody, loadGeoReport } from './geoReportData.js'

export function normalizeMarketplaceRows(data) {
  if (!Array.isArray(data)) throw new Error('The marketplace returned an unexpected parcel list.')
  return data.map((row) => {
    if (!row || typeof row !== 'object' || !(row.id != null || row.uuid) || !parseParcelGeometry(row.geojson)) {
      throw new Error('The marketplace returned a parcel with invalid geometry or identity.')
    }
    return { ...row, id: row.id ?? row.uuid }
  })
}

export function productFromResponse(response) {
  if (!Array.isArray(response?.data)) throw new Error('The product response did not contain a data list.')
  return response.data[0] ?? null
}

export function productLookupBody(uuid) { return { data: uuid } }

export function interestMessageBody(product, user, content) {
  return {
    sender_id: user.email,
    receiver_id: product.owner_uuid,
    content,
    uuid_post: product.uuid,
    objet: `${user.email} | ${product.parcel_name} | ${product.owner_uuid}`,
  }
}
