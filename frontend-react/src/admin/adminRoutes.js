export const ADMIN_NAV_ITEMS = Object.freeze([
  { section: 'parcels', label: 'Parcel', href: '/admin/parcels' },
  { section: 'conversations', label: 'Message', href: '/admin/conversations' },
  { section: 'users', label: 'Users', href: '/admin/users' },
  { section: 'dashboard', label: 'Dashboard', href: '/admin/dashboard' },
])

const DETAIL_ROUTES = Object.freeze([
  { base: '/admin/parcels', section: 'parcels' },
  { base: '/admin/users', section: 'users' },
  { base: '/admin/conversations', section: 'conversations' },
])

export function isAdminPath(pathname) {
  return typeof pathname === 'string' && /^\/admin(?:\/|$)/.test(pathname)
}

export function resolveAdminRoute(pathname) {
  if (!isAdminPath(pathname)) return null

  const normalizedPath = pathname.replace(/\/+$/, '') || '/'
  if (normalizedPath === '/admin' || normalizedPath === '/admin/access' || normalizedPath === '/admin/dashboard') {
    return { section: 'dashboard', view: 'overview', href: normalizedPath }
  }
  if (normalizedPath === '/admin/conversation-reports') {
    return { section: 'conversations', view: 'reports', href: normalizedPath }
  }

  for (const route of DETAIL_ROUTES) {
    if (normalizedPath === route.base) {
      return { section: route.section, view: 'list', href: route.base }
    }

    if (normalizedPath.startsWith(`${route.base}/`)) {
      const encodedId = normalizedPath.slice(route.base.length + 1)
      if (!encodedId || encodedId.includes('/')) return { section: route.section, view: 'notFound', href: normalizedPath }

      try {
        const id = decodeURIComponent(encodedId)
        if (!id.trim() || id.includes('/') || id === '.' || id === '..') {
          return { section: route.section, view: 'notFound', href: normalizedPath }
        }
        return { section: route.section, view: 'detail', id, href: normalizedPath }
      } catch {
        return { section: route.section, view: 'notFound', href: normalizedPath }
      }
    }
  }

  return { section: null, view: 'notFound', href: normalizedPath }
}

export function getAdminReturnPath(value) {
  if (typeof value !== 'string' || !isAdminPath(value)) return null
  const pathname = value.split(/[?#]/, 1)[0]
  const route = resolveAdminRoute(pathname)
  return route && route.view !== 'notFound' ? pathname : null
}

export function getAdminSignInHref(pathname) {
  const returnPath = getAdminReturnPath(pathname) || '/admin/dashboard'
  return `/signin?next=${encodeURIComponent(returnPath)}`
}
