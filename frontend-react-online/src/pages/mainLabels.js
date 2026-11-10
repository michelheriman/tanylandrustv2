export const MAIN_LABELS = {
  filter: { en: 'Filter:', fr: 'Filtrer :' },
  languageMenu: {
    en: 'Change language, English selected',
    fr: 'Changer de langue, français sélectionné',
  },
  switchLanguage: { en: 'Switch language', fr: 'Changer de langue' },
}

export const PARCEL_STATUS_OPTIONS = {
  sell_category: [
    { value: 'to_sell', en: 'For sale', fr: 'À vendre' },
    { value: 'vendu', en: 'Sold', fr: 'Vendue' },
    { value: 'autre', en: 'Other', fr: 'Autre' },
    { value: 'na', en: '#NA', fr: '#NA' },
  ],
  status_category: [
    { value: 'titre', en: 'Title deed', fr: 'Titre' },
    { value: 'titre_borne', en: 'Property title', fr: 'Titre et borne' },
    { value: 'kt', en: 'Land certificate', fr: 'Karan-tany' },
    { value: 'na', en: '#NA', fr: '#NA' },
  ],
}

export function parcelStatusLabel(category, value, lang) {
  if (value == null || value === '') return '—'
  return PARCEL_STATUS_OPTIONS[category]?.find((option) => option.value === value)?.[lang] ?? value
}
