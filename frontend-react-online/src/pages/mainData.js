import { squareMetersToHectares } from './parcelPricing.js'

const EDITABLE_FIELDS = new Set([
  'parcel_name', 'declared_area_ha', 'price_m2', 'currency', 'location_name',
  'description', 'sell_category', 'status_category',
])
const EDITABLE_FORM_FIELDS = new Set([
  'parcel_name', 'declared_area_m2', 'price_m2', 'currency', 'location_name',
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

export function removeDeletedOwnerParcel(state, parcelId) {
  const id = String(parcelId)
  const matchesDeletedParcel = (value) => value != null && String(value) === id
  return {
    ...state,
    parcels: state.parcels.filter((parcel) => String(parcel.id) !== id),
    selectedParcelId: matchesDeletedParcel(state.selectedParcelId) ? null : state.selectedParcelId,
    expandedParcelId: matchesDeletedParcel(state.expandedParcelId) ? null : state.expandedParcelId,
    deleteConfirmationId: null,
  }
}

export async function saveParcelField(request, rowId, field, value) {
  if (!EDITABLE_FIELDS.has(field) || rowId == null) throw new Error('This parcel field cannot be updated.')
  return request('/update_t', {
    method: 'POST',
    body: JSON.stringify({ element: { [field]: value }, id: rowId }),
  })
}

export async function saveParcelFields(request, rowId, changedFields, values) {
  if (rowId == null || !Array.isArray(changedFields)
    || changedFields.some((field) => !EDITABLE_FORM_FIELDS.has(field?.key))) {
    return { success: false, error: new Error('This parcel update contains a field that cannot be changed.') }
  }
  try {
    const element = Object.fromEntries(changedFields.map((field) => {
      if (field.key === 'declared_area_m2') {
        const areaHa = squareMetersToHectares(values[field.key])
        if (areaHa === null) throw new Error('Enter a valid parcel area in square metres.')
        return ['declared_area_ha', areaHa]
      }
      return [field.key, values[field.key]]
    }))
    await request('/update_t', {
      method: 'POST',
      body: JSON.stringify({ element, id: rowId }),
    })
    return { success: true }
  } catch (error) {
    try {
      return { success: false, error, reconciledRows: await loadParcels(request) }
    } catch (reconciliationError) {
      return { success: false, error, reconciliationError, reconciledRows: null }
    }
  }
}
