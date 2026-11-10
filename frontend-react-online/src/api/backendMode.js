export function isLocalBackendConfigured(mode = import.meta.env?.MODE) {
  return mode === 'localdev'
}
