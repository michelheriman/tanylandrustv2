const EDITABLE_FIELDS = new Set([
  'owner', 'parcel_name', 'price_m2', 'price', 'location_name',
  'description', 'sell_category', 'status_category',
])

const parcelLoadFlights = new WeakMap()

export function loadParcels(request) {
  const activeFlight = parcelLoadFlights.get(request)
  if (activeFlight) return activeFlight

  const flight = Promise.resolve()
    .then(() => request('/map-data'))
    .then((response) => {
      if (!Array.isArray(response.data)) throw new Error('The parcel list has an unexpected format.')
      return response.data
    })

  parcelLoadFlights.set(request, flight)
  const clearFlight = () => {
    if (parcelLoadFlights.get(request) === flight) parcelLoadFlights.delete(request)
  }
  void flight.then(clearFlight, clearFlight)
  return flight
}

export async function saveParcelField(request, rowId, field, value) {
  if (!EDITABLE_FIELDS.has(field) || rowId == null) throw new Error('This parcel field cannot be updated.')
  return request('/update_t', {
    method: 'POST',
    body: JSON.stringify({ element: { [field]: value }, id: rowId }),
  })
}

export async function saveParcelFields(request, rowId, changedFields, values) {
  try {
    for (const field of changedFields) {
      await saveParcelField(request, rowId, field.key, values[field.key])
    }
    return { success: true }
  } catch (error) {
    try {
      return { success: false, error, reconciledRows: await loadParcels(request) }
    } catch (reconciliationError) {
      return { success: false, error, reconciliationError, reconciledRows: null }
    }
  }
}
