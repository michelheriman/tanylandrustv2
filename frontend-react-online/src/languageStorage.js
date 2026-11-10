export const LANGUAGE_STORAGE_KEY = 'language'
export const LEGACY_LANGUAGE_STORAGE_KEY = 'tany.home.lang'
export const DEFAULT_LANGUAGE = 'en'

export function isSupportedLanguage(value) {
  return value === 'en' || value === 'fr'
}

export function readLanguage(storage) {
  let target
  let current
  let legacy

  try {
    target = storage ?? globalThis.localStorage
    current = target.getItem(LANGUAGE_STORAGE_KEY)
    legacy = target.getItem(LEGACY_LANGUAGE_STORAGE_KEY)
  } catch {
    return DEFAULT_LANGUAGE
  }

  if (isSupportedLanguage(current)) {
    try { if (legacy !== null) target.removeItem(LEGACY_LANGUAGE_STORAGE_KEY) } catch { /* Keep the valid canonical preference. */ }
    return current
  }

  if (isSupportedLanguage(legacy)) {
    try { target.setItem(LANGUAGE_STORAGE_KEY, legacy) } catch { /* Use the legacy preference for this visit. */ }
    try { target.removeItem(LEGACY_LANGUAGE_STORAGE_KEY) } catch { /* The canonical value takes precedence next time. */ }
    return legacy
  }

  try { target.setItem(LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE) } catch { /* Keep the default for this visit. */ }
  try { if (legacy !== null) target.removeItem(LEGACY_LANGUAGE_STORAGE_KEY) } catch { /* Ignore unavailable legacy cleanup. */ }
  return DEFAULT_LANGUAGE
}

export function writeLanguage(language, storage) {
  if (!isSupportedLanguage(language)) return false

  try {
    const target = storage ?? globalThis.localStorage
    target.setItem(LANGUAGE_STORAGE_KEY, language)
    try { target.removeItem(LEGACY_LANGUAGE_STORAGE_KEY) } catch { /* The canonical value still wins. */ }
    return true
  } catch {
    return false
  }
}
