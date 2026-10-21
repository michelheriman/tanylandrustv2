export const ADMIN_UNAVAILABLE_MESSAGE = 'Données non disponibles pour le moment.'

const PAGE_MODELS = Object.freeze({
  dashboard: {
    title: 'Dashboard',
    description: 'Platform overview.',
    metrics: [
      'Annonces à vendre maintenant',
      'Annonces contactées',
      'Conversations sans première réponse',
      'Inscriptions ce mois',
      'Constats internes récents',
    ],
  },
  parcels: {
    title: 'Parcel',
    description: 'Parcel list and review.',
    columns: ['Parcel name', 'User', 'Surface', 'Price', 'Date', 'Action'],
    actions: ['Consult'],
    filters: true,
  },
  users: {
    title: 'Users',
    description: 'User accounts and status.',
    columns: ['User name', 'Email', 'Status', 'Date', 'Action'],
    actions: ['Consult'],
    filters: true,
  },
  conversations: {
    title: 'Message',
    description: 'Conversations and reports.',
    columns: ['Parcel', 'Users', 'Last message', 'Action'],
    actions: ['Consult'],
    filters: false,
  },
})

const DETAIL_TITLES = Object.freeze({
  parcels: 'Parcel details',
  users: 'User details',
  conversations: 'Conversation details',
})

export function getAdminPageModel(route) {
  if (!route || route.view === 'notFound') {
    return { title: 'Page not found', kind: 'notFound' }
  }

  const section = PAGE_MODELS[route.section]
  if (!section) return { title: 'Page not found', kind: 'notFound' }

  if (route.section === 'dashboard') {
    return { ...section, kind: 'dashboard', unavailableMessage: ADMIN_UNAVAILABLE_MESSAGE }
  }

  if (route.view === 'reports' && route.section === 'conversations') {
    return {
      ...section,
      title: 'Constats internes récents',
      kind: 'reports',
      unavailableMessage: ADMIN_UNAVAILABLE_MESSAGE,
    }
  }

  if (route.view === 'detail') {
    return {
      ...section,
      title: DETAIL_TITLES[route.section],
      kind: 'detail',
      backHref: `/admin/${route.section}`,
      unavailableMessage: ADMIN_UNAVAILABLE_MESSAGE,
      actionDisabled: true,
    }
  }

  if (route.view === 'list') {
    return {
      ...section,
      kind: 'list',
      unavailableMessage: ADMIN_UNAVAILABLE_MESSAGE,
      actionsDisabled: true,
    }
  }

  return { title: 'Page not found', kind: 'notFound' }
}
