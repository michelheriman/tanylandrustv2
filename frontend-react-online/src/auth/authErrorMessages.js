import { apiErrorMessage } from '../api/apiErrorMessages.js'
import { AUTH_TRANSLATIONS } from '../authTranslations.js'

function languageKey(lang) {
  return lang === 'fr' ? 'fr' : 'en'
}

export function signInErrorMessage(error, lang = 'en') {
  const copy = AUTH_TRANSLATIONS[languageKey(lang)].signIn
  if (error?.kind === 'auth' || error?.status === 401) return copy.invalidCredentials
  return apiErrorMessage(error, lang) || copy.requestFailed
}

export function signUpErrorMessage(error, lang = 'en') {
  const copy = AUTH_TRANSLATIONS[languageKey(lang)].signUp
  if (error?.status === 409) return copy.accountInUse
  if (error?.status === 400) return copy.requiredFields
  return apiErrorMessage(error, lang) || copy.registrationFailed
}
