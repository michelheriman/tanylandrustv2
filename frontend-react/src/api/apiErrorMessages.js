/**
 * Return localized, user-safe copy for errors created by the shared API layer.
 * ApiError.message is diagnostic metadata; UI code should use this presenter.
 */
export function apiErrorMessage(error, lang = 'en') {
  if (error?.name !== 'ApiError') return null

  const language = lang === 'fr' ? 'fr' : 'en'
  const status = Number(error.status) || 0
  const copy = {
    en: {
      network: 'Unable to reach the server. Check your connection and try again.',
      auth: 'Your session has expired or was refused. Sign in again to continue.',
      forbidden: 'You do not have permission to perform this action.',
      notFound: 'The requested resource was not found.',
      unavailable: 'The service is temporarily unavailable. Please try again later.',
      invalidResponse: 'The server returned an invalid response. Please try again.',
      request: 'The request could not be completed. Check the information and try again.',
      sessionChanged: 'Your session changed. Please try again.',
      logout: 'Your local session was closed, but the server could not confirm sign out.',
    },
    fr: {
      network: 'Impossible de contacter le serveur. Vérifiez votre connexion puis réessayez.',
      auth: 'Votre session a expiré ou a été refusée. Reconnectez-vous pour continuer.',
      forbidden: 'Vous n’avez pas l’autorisation d’effectuer cette action.',
      notFound: 'La ressource demandée est introuvable.',
      unavailable: 'Le service est temporairement indisponible. Réessayez plus tard.',
      invalidResponse: 'Le serveur a renvoyé une réponse invalide. Veuillez réessayer.',
      request: 'La demande n’a pas abouti. Vérifiez les informations puis réessayez.',
      sessionChanged: 'Votre session a changé. Veuillez réessayer.',
      logout: 'Votre session locale a été fermée, mais le serveur n’a pas confirmé la déconnexion.',
    },
  }[language]

  if (status === 401 || error.kind === 'auth') return copy.auth
  if (status === 403) return copy.forbidden
  if (status === 404) return copy.notFound
  if (status >= 500 || error.kind === 'server' || error.kind === 'unavailable') return copy.unavailable
  if (error.kind === 'network') return copy.network
  if (error.kind === 'protocol') return copy.invalidResponse
  if (error.kind === 'cancelled') return copy.sessionChanged
  if (error.kind === 'logout') return copy.logout
  return copy.request
}
