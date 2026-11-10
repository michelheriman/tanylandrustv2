import { isAdminPath, resolveAdminRoute } from './adminRoutes.js'

export function getAdminNavigationTarget(href, origin) {
  try {
    const target = new URL(href, origin)
    if (target.origin !== new URL(origin).origin || !isAdminPath(target.pathname)) return null
    const route = resolveAdminRoute(target.pathname)
    if (!route) return null
    return {
      href: `${target.pathname}${target.search}${target.hash}`,
      route: { ...route, navigationHref: `${target.pathname}${target.search}${target.hash}` },
    }
  } catch {
    return null
  }
}

export function shouldHandleAdminLinkClick(event) {
  return !event.defaultPrevented && event.button === 0 &&
    !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}
