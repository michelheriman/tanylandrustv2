import { useContext } from 'react'
import { AuthContext } from './AuthContext.js'

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth nécessite AuthProvider.')
  return auth
}
