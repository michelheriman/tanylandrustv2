const EDITABLE_FIELDS = new Set([
  'owner', 'parcel_name', 'price_m2', 'price', 'location_name',
  'description', 'sell_category', 'status_category',
])

export async function loadParcels(request) {
  const response = await request('/map-data')
  if (!Array.isArray(response.data)) throw new Error('The parcel list has an unexpected format.')
  return response.data
}

export async function saveParcelField(request, rowId, field, value) {
  if (!EDITABLE_FIELDS.has(field) || rowId == null) throw new Error('This parcel field cannot be updated.')
  return request('/update_t', {
    method: 'POST',
    body: JSON.stringify({ element: { [field]: value }, id: rowId }),
  })
}
