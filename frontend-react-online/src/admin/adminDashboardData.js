export const ADMIN_REGISTRATION_DEFAULT_MONTHS = 9
export const ADMIN_REGISTRATION_MAX_MONTHS = 24
export const ADMIN_REGISTRATION_DEFINITION =
  'Profiles still present, grouped by created_at in UTC calendar months; not a lifetime count of all accounts ever created.'

export const ADMIN_DASHBOARD_DEFINITIONS = Object.freeze({
  for_sale: "Marketplace-visible parcels whose sell_category is 'to_sell' at the current snapshot; manually hidden parcels are excluded.",
  contacted_parcels: 'Distinct parcels with a linked Marketplace message in conversations created during the rolling 30-day UTC period; conversations without a parcel are excluded.',
  awaiting_first_response: 'Current Marketplace conversations with exactly two participants and a linked first message whose recipient has not replied.',
  registrations: 'Profiles still present whose created_at falls in the current UTC calendar month; not a lifetime count of all accounts ever created.',
  recent_reports: 'Internal conversation finding rows created during the rolling 30-day UTC period; this is not a processing or unresolved count.',
})

function isValidUtcTimestamp(value) {
  return typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(Date.parse(value))
}

function isValidPeriod(value) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    isValidUtcTimestamp(value.start) && isValidUtcTimestamp(value.end) &&
    Date.parse(value.start) < Date.parse(value.end)
}

export function isValidAdminDashboardMetrics(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !isValidUtcTimestamp(value.as_of)) return false
  const snapshotKeys = ['for_sale', 'awaiting_first_response']
  for (const key of snapshotKeys) {
    const metric = value[key]
    if (!metric || typeof metric !== 'object' || Array.isArray(metric) ||
        !Number.isSafeInteger(metric.count) || metric.count < 0 ||
        metric.period?.kind !== 'current_snapshot' ||
        metric.definition !== ADMIN_DASHBOARD_DEFINITIONS[key]) return false
  }

  for (const key of ['contacted_parcels', 'registrations', 'recent_reports']) {
    const metric = value[key]
    if (!metric || typeof metric !== 'object' || Array.isArray(metric) ||
        !Number.isSafeInteger(metric.count) || metric.count < 0 ||
        !isValidPeriod(metric.period) || metric.definition !== ADMIN_DASHBOARD_DEFINITIONS[key]) return false
  }
  return value.registrations.period.month === value.registrations.period.start.slice(0, 7) &&
    value.registrations.period.end.slice(8, 10) === '01' &&
    value.contacted_parcels.period.end === value.as_of &&
    value.recent_reports.period.end === value.as_of
}

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/

function nextMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  const nextYear = monthNumber === 12 ? year + 1 : year
  const nextMonthNumber = monthNumber === 12 ? 1 : monthNumber + 1
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonthNumber).padStart(2, '0')}`
}

export function isValidAdminRegistrationDashboard(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      value.definition !== ADMIN_REGISTRATION_DEFINITION ||
      typeof value.current_month !== 'string' || !MONTH_KEY.test(value.current_month) ||
      !Number.isSafeInteger(value.current_month_count) || value.current_month_count < 0 ||
      !value.period || typeof value.period !== 'object' || Array.isArray(value.period) ||
      !Array.isArray(value.monthly) || value.monthly.length < 1 ||
      value.monthly.length > ADMIN_REGISTRATION_MAX_MONTHS) return false

  if (value.period.start_month !== value.monthly[0]?.month ||
      value.period.end_month !== value.current_month ||
      value.monthly.at(-1)?.month !== value.current_month) return false

  let expectedMonth = value.period.start_month
  for (const point of value.monthly) {
    if (!point || typeof point !== 'object' || Array.isArray(point) ||
        point.month !== expectedMonth || !MONTH_KEY.test(point.month) ||
        !Number.isSafeInteger(point.count) || point.count < 0) return false
    expectedMonth = nextMonth(expectedMonth)
  }

  return value.monthly.at(-1).count === value.current_month_count
}
