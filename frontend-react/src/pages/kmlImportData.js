export const MAX_KML_FILE_SIZE = 10 * 1024 * 1024
export const KML_CURRENCIES = ['USD', 'EUR', 'KES', 'TZS', 'UGX', 'RWF', 'BIF', 'SOS', 'ETB', 'DJF', 'EGP', 'SDG', 'SSP', 'MGA']
export const KML_CURRENCY_LABELS = {
  USD: 'USD - US Dollar ($)', EUR: 'EUR - Euro (€)', KES: 'KES - Kenyan Shilling (KSh)',
  TZS: 'TZS - Tanzanian Shilling (TSh)', UGX: 'UGX - Ugandan Shilling (USh)',
  RWF: 'RWF - Rwandan Franc (FRw)', BIF: 'BIF - Burundian Franc (FBu)',
  SOS: 'SOS - Somali Shilling (Sh.So.)', ETB: 'ETB - Ethiopian Birr (Br)',
  DJF: 'DJF - Djiboutian Franc (Fdj)', EGP: 'EGP - Egyptian Pound (£E)',
  SDG: 'SDG - Sudanese Pound (SDG)', SSP: 'SSP - South Sudanese Pound (SS£)',
  MGA: 'MGA - Malagasy Ariary (Ar)',
}
export const KML_SALE_CATEGORIES = ['to_sell', 'vendu', 'autre', 'na']
export const KML_TITLE_STATUSES = ['titre', 'titre_borne', 'kt', 'na']

export function validateKmlFile(file) {
  if (!file) return 'required'
  if (typeof file.name !== 'string' || !file.name.toLowerCase().endsWith('.kml')) return 'extension'
  if (!Number.isFinite(file.size) || file.size > MAX_KML_FILE_SIZE) return 'size'
  return null
}

export function validateKmlFields(fields) {
  if (!fields.owner.trim()) return 'owner'
  if (!fields.parcel_name.trim()) return 'parcel_name'
  if (!fields.location_name.trim()) return 'location_name'
  if (!fields.sell_category || !KML_SALE_CATEGORIES.includes(fields.sell_category)) return 'sell_category'
  if (!fields.status_category || !KML_TITLE_STATUSES.includes(fields.status_category)) return 'status_category'
  if (fields.currency && !KML_CURRENCIES.includes(fields.currency)) return 'currency'
  if (fields.price.trim() && (!Number.isFinite(Number(fields.price)) || Number(fields.price) < 0)) return 'price'
  if (fields.price_m2.trim() && (!Number.isFinite(Number(fields.price_m2)) || Number(fields.price_m2) < 0)) return 'price_m2'
  return null
}

export function createKmlUploadForm({ file, fields, ownerEmail }, FormDataType = FormData) {
  const fileError = validateKmlFile(file)
  if (fileError) throw new Error(`Invalid KML file: ${fileError}.`)
  const fieldError = validateKmlFields(fields)
  if (fieldError) throw new Error(`Invalid parcel field: ${fieldError}.`)
  if (!ownerEmail) throw new Error('The signed-in user email is unavailable.')

  const body = new FormDataType()
  body.append('kmlFile', file, file.name)
  body.append('owner', fields.owner.trim())
  body.append('owner_uuid', ownerEmail)
  body.append('parcel_name', fields.parcel_name.trim())
  body.append('price_m2', fields.price_m2.trim())
  body.append('price', fields.price.trim())
  body.append('currency', fields.currency)
  body.append('location_name', fields.location_name.trim())
  body.append('description', fields.description.trim())
  body.append('sell_category', fields.sell_category)
  body.append('status_category', fields.status_category)
  return body
}

export async function uploadKmlParcel(request, input, FormDataType = FormData) {
  const body = createKmlUploadForm(input, FormDataType)
  return request('/upload-kml', { method: 'POST', body, acceptStatusSuccess: true })
}
