export function resolveAuthRoute(pathname, status, { isGeoReport = false, isAdminRoute = false } = {}) {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'
  const isAdmin = isAdminRoute || /^\/admin(?:\/|$)/.test(normalizedPath)
  const isKnownRoute = normalizedPath === '/' || normalizedPath === '/signin' || normalizedPath === '/signup' || normalizedPath === '/main' || normalizedPath === '/main.html' || normalizedPath === '/terms' || normalizedPath === '/privacy' || isGeoReport || isAdmin
  if (!isKnownRoute) return 'notFound'

  const isMain = normalizedPath === '/main' || normalizedPath === '/main.html'
  const isProtected = isMain || isGeoReport

  if (status === 'unavailable') {
    if (normalizedPath === '/signin') return 'signin'
    if (normalizedPath === '/signup') return 'signup'
    return 'unavailable'
  }

  // Admin routes can render their empty workspace shell while the saved
  // session is restored. Protected data still waits for authentication and
  // every admin API remains independently authorized by the server.
  if (status === 'restoring') return isAdmin ? 'admin' : 'restoring'

  if (status === 'anonymous') {
    if (isAdmin) return 'adminAccess'
    if (isProtected) return 'redirect'
    return normalizedPath === '/signup' ? 'signup' : 'signin'
  }

  if (status === 'authenticated' || status === 'signingOut') {
    if (isAdmin) return 'admin'
    return isGeoReport ? 'georeport' : 'main'
  }

  return normalizedPath === '/signup' ? 'signup' : 'signin'
}
