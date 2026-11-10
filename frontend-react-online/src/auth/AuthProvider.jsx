import { useEffect, useSyncExternalStore } from 'react'
import { AuthContext } from './AuthContext.js'
import { authService } from './authService.js'

export function AuthProvider({ children }) {
  const state = useSyncExternalStore(authService.subscribe, authService.getSnapshot)
  const bootstrapAdmin = /^\/admin(?:\/|$)/.test(globalThis.location?.pathname ?? '')
  useEffect(() => { void authService.restore({ bootstrapAdmin }) }, [bootstrapAdmin])
  return <AuthContext.Provider value={{ ...state, ...authService }}>{children}</AuthContext.Provider>
}
