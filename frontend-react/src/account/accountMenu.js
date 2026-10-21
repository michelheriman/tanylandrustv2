export function accountDisplayName(user) {
  for (const value of [user?.name, user?.username, user?.email]) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return 'Tany account'
}

export function accountInitials(user) {
  const name = accountDisplayName(user)
  const words = name.split(/[\s@._-]+/).filter(Boolean)
  if (!words.length) return 'TA'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words.at(-1)[0]}`.toUpperCase()
}

export function accountPageHash(page) {
  if (page !== 'profile' && page !== 'offer') throw new TypeError('Unknown account page')
  return `/main#${page}`
}

export function accountPageFromHash(hash) {
  return hash === '#profile' ? 'profile' : hash === '#offer' ? 'offer' : null
}

export function isAccountMenuEscape(key) {
  return key === 'Escape'
}

export function isOutsideAccountMenu(target, menuRoot) {
  return Boolean(menuRoot && target && !menuRoot.contains(target))
}
