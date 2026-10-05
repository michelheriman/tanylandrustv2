export function resolveAuthRoute(pathname, status, { isGeoReport = false } = {}) {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'
  const isMain = normalizedPath === '/main' || normalizedPath === '/main.html'
  const isProtected = isMain || isGeoReport

  if (status === 'unavailable') {
    if (normalizedPath === '/signin') return 'signin'
    if (normalizedPath === '/signup') return 'signup'
    return 'unavailable'
  }

  if (status === 'restoring') return 'restoring'

  if (status === 'anonymous') {
    if (isProtected) return 'redirect'
    return normalizedPath === '/signup' ? 'signup' : 'signin'
  }

  if (status === 'authenticated' || status === 'signingOut') {
    return isGeoReport ? 'georeport' : 'main'
  }

  return normalizedPath === '/signup' ? 'signup' : 'signin'
}
