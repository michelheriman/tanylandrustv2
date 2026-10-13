import { useEffect, useSyncExternalStore } from 'react'
import { AuthContext } from './AuthContext.js'
import { authService } from './authService.js'

export function AuthProvider({ children }) {
  const state = useSyncExternalStore(authService.subscribe, authService.getSnapshot)
  useEffect(() => { void authService.restore() }, [])
  return <AuthContext.Provider value={{ ...state, ...authService }}>{children}</AuthContext.Provider>
}
