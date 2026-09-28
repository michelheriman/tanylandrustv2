import { ApiError } from '../api/client.js'

export const SESSION_KEY = 'tany.auth.session'

// One entry replaces both tokens together, preserving unrelated local data.
export function createSessionStorage(getStorage = () => globalThis.localStorage) {
  return {
    read() {
      try {
        const storage = getStorage()
        const raw = storage.getItem(SESSION_KEY)
        if (!raw) {
          const accessToken = storage.getItem('auth_token')
          const refreshToken = storage.getItem('refresh_token')
          if (!accessToken || !refreshToken) return null
          let user = null
          try { user = JSON.parse(storage.getItem('user') ?? 'null') } catch { user = null }
          const session = { accessToken, refreshToken, user }
          storage.setItem(SESSION_KEY, JSON.stringify(session))
          storage.removeItem('auth_token')
          storage.removeItem('refresh_token')
          storage.removeItem('user')
          return session
        }
        const session = JSON.parse(raw)
        if (typeof session?.accessToken !== 'string' || !session.accessToken ||
            typeof session?.refreshToken !== 'string' || !session.refreshToken) return null
        return session
      } catch {
        throw new ApiError('storage', 'Impossible de lire la session enregistrée dans ce navigateur.')
      }
    },
    write(session) {
      try { getStorage().setItem(SESSION_KEY, JSON.stringify(session)) } catch {
        throw new ApiError('storage', 'Impossible d’enregistrer la session dans ce navigateur.')
      }
    },
    clear() {
      try { getStorage().removeItem(SESSION_KEY) } catch {
        throw new ApiError('storage', 'Impossible de supprimer la session enregistrée. Effacez les données de ce site dans votre navigateur.')
      }
    },
  }
}
