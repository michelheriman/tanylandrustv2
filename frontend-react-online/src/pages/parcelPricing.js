const CURRENCY_MINOR_UNITS = {
  USD: 2, EUR: 2, KES: 2, TZS: 2, UGX: 0, RWF: 0, BIF: 0,
  SOS: 2, ETB: 2, DJF: 0, EGP: 2, SDG: 2, SSP: 2, MGA: 2,
}

export function currencyMinorUnits(currency) {
  return CURRENCY_MINOR_UNITS[String(currency ?? '').trim().toUpperCase()]
}

export function formatExactPricingAmount(value, currency, locale = 'en-US') {
  const text = String(value ?? '').trim()
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text)
  // Unknown historical currency codes remain visible; current form choices
  // are validated separately against the supported currency list.
  const minorUnits = currencyMinorUnits(currency) ?? 0
  if (!match) return '—'

  const integer = BigInt(match[2]).toLocaleString(locale)
  let fraction = match[3] ?? ''
  while (fraction.length > minorUnits && fraction.endsWith('0')) fraction = fraction.slice(0, -1)
  while (fraction.length < minorUnits) fraction += '0'
  const decimalSeparator = new Intl.NumberFormat(locale)
    .formatToParts(1.1)
    .find((part) => part.type === 'decimal')?.value ?? '.'
  return `${match[1] === '-' ? '-' : ''}${integer}${fraction ? `${decimalSeparator}${fraction}` : ''}`
}

function decimalUnits(value, scale = 8) {
  const text = String(value ?? '').trim()
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text)
  if (!match || (match[2]?.length ?? 0) > scale) return null
  const fraction = (match[2] ?? '').padEnd(scale, '0')
  try { return BigInt(match[1]) * (10n ** BigInt(scale)) + BigInt(fraction || '0') } catch { return null }
}

function decimalTextFromUnits(units, scale) {
  const divisor = 10n ** BigInt(scale)
  const whole = units / divisor
  const fraction = String(units % divisor).padStart(scale, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole.toString()
}

function formatUnits(units, scale, locale) {
  const divisor = 10n ** BigInt(scale)
  const whole = (units / divisor).toLocaleString(locale)
  const fraction = String(units % divisor).padStart(scale, '0').replace(/0+$/, '')
  if (!fraction) return whole
  const decimalSeparator = new Intl.NumberFormat(locale)
    .formatToParts(1.1)
    .find((part) => part.type === 'decimal')?.value ?? '.'
  return `${whole}${decimalSeparator}${fraction}`
}

export function squareMetersToHectares(squareMeters) {
  const units = decimalUnits(squareMeters, 4)
  return units === null ? null : decimalTextFromUnits(units, 8)
}

export function hectaresToSquareMeters(hectares) {
  const units = decimalUnits(hectares, 12)
  return units === null ? null : decimalTextFromUnits(units, 8)
}

export function formatAreaSquareMeters(hectares, locale = 'en-US') {
  if (hectares === null || hectares === undefined || hectares === '') return '—'
  const units = decimalUnits(hectares, 12)
  if (units === null) return '—'
  return `${formatUnits(units, 8, locale)} m\u00b2`
}

export function isPositiveAreaSquareMeters(value) {
  const units = decimalUnits(value, 4)
  return units !== null && units > 0n
}

export function isPositivePricingDecimal(value) {
  const units = decimalUnits(value)
  return units !== null && units > 0n
}

export function estimateParcelTotal(areaSquareMeters, priceM2, currency) {
  const area = decimalUnits(areaSquareMeters, 4)
  const rate = decimalUnits(priceM2)
  const minorUnits = CURRENCY_MINOR_UNITS[String(currency ?? '').trim().toUpperCase()]
  if (area === null || area <= 0n || rate === null || rate <= 0n || minorUnits === undefined) return null

  const denominator = 10n ** 12n
  const numerator = area * rate * (10n ** BigInt(minorUnits))
  const roundedMinor = (numerator + denominator / 2n) / denominator
  if (roundedMinor <= 0n) return null
  const whole = roundedMinor / (10n ** BigInt(minorUnits))
  if (minorUnits === 0) return whole.toString()
  const fraction = String(roundedMinor % (10n ** BigInt(minorUnits))).padStart(minorUnits, '0')
  return `${whole}.${fraction}`
}
