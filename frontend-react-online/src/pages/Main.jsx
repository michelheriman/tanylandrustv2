import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth.js'
import { apiErrorMessage } from '../api/apiErrorMessages.js'
import { isLocalBackendConfigured } from '../api/backendMode.js'
import AccountPage from '../account/AccountPage.jsx'
import { ACCOUNT_LABELS } from '../account/accountLabels.js'
import { loadAccountOffer } from '../account/accountData.js'
import { accountDisplayName, accountPageFromHash, accountPageHash, isAccountMenuEscape, isOutsideAccountMenu } from '../account/accountMenu.js'
import {
  canShowOwnerParcelDelete,
  deleteOwnedParcel,
  effectiveOfferSummary,
  loadOwnerParcelDeletionRights,
  markOwnerParcelDeleteDenied,
  parcelDeletionErrorMessage,
} from '../api/parcelDeletion.js'
import Icon from '../components/Icon.jsx'
import { readLanguage, writeLanguage } from '../languageStorage.js'
import { focusFirstDialogField, handleDialogKeydown, restoreDialogFocus } from './mainDialogFocus.js'
import { loadParcels, removeDeletedOwnerParcel, saveParcelFields } from './mainData.js'
import { MAIN_LABELS, PARCEL_STATUS_OPTIONS, parcelStatusLabel } from './mainLabels.js'
import { addParcelStepForField, createParcel, findInvalidAddParcelControl, isValidParcelBoundary } from './parcelMapData.js'
import { applyPageMetadata } from '../seoMetadata.js'
import ParcelMap from './ParcelMap.jsx'
import KmlImport from './KmlImport.jsx'
import {
  estimateParcelTotal,
  formatAreaSquareMeters,
  hectaresToSquareMeters,
  isPositiveAreaSquareMeters,
  isPositivePricingDecimal,
} from './parcelPricing.js'
import Marketplace from './Marketplace.jsx'
import Chat from './Chat.jsx'
import AssistantPanel from './AssistantPanel.jsx'
import { assistantConversationKey, hasEffectiveLocalProAssistantAccess } from './chatAssistantData.js'
import LandLaw from './LandLaw.jsx'
import './Main.css'

const tabs = [
  { id: 'dashboard', icon: 'parcel', en: 'Parcel', fr: 'Parcelle' },
  { id: 'crops', icon: 'marketplace', en: 'Market Place', fr: 'Marché' },
  { id: 'tasks', icon: 'message', en: 'Message', fr: 'Message' },
  { id: 'yields', icon: 'scales', en: 'Land law', fr: 'Droit foncier' },
]

const pages = {
  crops: { en: ['Market Place', 'Browse listings, buy, and sell produce directly.'], fr: ['Marché', 'Parcourez les annonces, achetez et vendez directement.'] },
  tasks: { en: ['Private Message', 'Communicate securely with your network.'], fr: ['Messages privés', 'Communiquez en toute sécurité avec votre réseau.'] },
  yields: { en: ['Land Law', ''], fr: ['Droit foncier', ''] },
}

const currencies = ['USD', 'EUR', 'KES', 'TZS', 'UGX', 'RWF', 'BIF', 'SOS', 'ETB', 'DJF', 'EGP', 'SDG', 'SSP', 'MGA']
const currencyOptions = currencies.map((value) => ({ value, en: value, fr: value }))
const fields = [
  { key: 'parcel_name', en: 'Parcel name', fr: 'Nom de la parcelle' },
  { key: 'price_m2', en: 'Declared price / m²', fr: 'Prix déclaré / m²', type: 'number' },
  { key: 'location_name', en: 'Location', fr: 'Localisation' },
  { key: 'description', en: 'Description', fr: 'Description' },
  { key: 'sell_category', en: 'Sale status', fr: 'Statut de vente', options: PARCEL_STATUS_OPTIONS.sell_category },
  { key: 'status_category', en: 'Title status', fr: 'Statut du titre', options: PARCEL_STATUS_OPTIONS.status_category },
]
const localFields = [
  { key: 'parcel_name', en: 'Parcel name', fr: 'Nom de la parcelle' },
  { key: 'declared_area_m2', en: 'Declared area (m\u00b2)', fr: 'Surface d\u00e9clar\u00e9e (m\u00b2)', type: 'number' },
  { key: 'price_m2', en: 'Declared price / m²', fr: 'Prix déclaré / m²', type: 'number' },
  { key: 'currency', en: 'Currency', fr: 'Devise', options: currencyOptions },
  { key: 'location_name', en: 'Location', fr: 'Localisation' },
  { key: 'description', en: 'Description', fr: 'Description' },
  { key: 'sell_category', en: 'Sale status', fr: 'Statut de vente', options: PARCEL_STATUS_OPTIONS.sell_category },
  { key: 'status_category', en: 'Title status', fr: 'Statut du titre', options: PARCEL_STATUS_OPTIONS.status_category },
]
const fieldLabels = Object.fromEntries(fields.map((field) => [field.key, field]))
const ownerLabel = { en: 'Owner', fr: 'Propri\u00e9taire' }

const emptyNewParcel = () => ({ owner: '', parcel_name: '', declared_area_m2: '', price_m2: '', currency: 'USD', location_name: '', description: '', sell_category: 'to_sell', status_category: '' })

function readTab() {
  const hash = window.location.hash.slice(1)
  return tabs.some((tab) => tab.id === hash) ? hash : 'dashboard'
}

function readAccountPage() {
  return accountPageFromHash(window.location.hash)
}

function ParcelCell({ row, field, lang, value, onChange, disabled }) {

  const label = `${field[lang]}, ${row.parcel_name || row.id}`
  if (field.options) return (
    <select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {!field.options.some(({ value: option }) => option === value) && <option value={value}>{value || '—'}</option>}
      {field.options.map((option) => <option key={option.value} value={option.value}>{option[lang]}</option>)}
    </select>
  )
  return <input aria-label={label} type={field.type || 'text'} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
}

function Dashboard({ lang }) {
  const { request, user, downloadKml } = useAuth()
  const localBackend = isLocalBackendConfigured()
  const editFields = localFields
  const [ownerDeletionRights, setOwnerDeletionRights] = useState(() => ({
    status: 'loading',
    canDeleteOwnedParcels: false,
  }))
  const [ownerDeletionDeniedIds, setOwnerDeletionDeniedIds] = useState(() => new Set())
  const [parcels, setParcels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('name')
  const [nameDescending, setNameDescending] = useState(false)
  const [selectedParcelId, setSelectedParcelId] = useState(null)
  const [focusVersion, setFocusVersion] = useState(0)
  const [expandedParcelId, setExpandedParcelId] = useState(null)
  const [editingParcelId, setEditingParcelId] = useState(null)
  const [editDraft, setEditDraft] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState(null)
  const editDialogRef = useRef(null)
  const editTriggerRef = useRef(null)
  const [addMode, setAddMode] = useState(false)
  const [addStep, setAddStep] = useState(1)
  const [kmlImportOpen, setKmlImportOpen] = useState(false)
  const [addForm, setAddForm] = useState(emptyNewParcel)
  const [draftGeometry, setDraftGeometry] = useState(null)
  const [savingAdd, setSavingAdd] = useState(false)
  const [addError, setAddError] = useState(null)
  const [resetDrawingKey, setResetDrawingKey] = useState(0)
  const [deleteConfirmationId, setDeleteConfirmationId] = useState(null)
  const [deletePending, setDeletePending] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const deleteFlightRef = useRef(false)
  useEffect(() => {
    let live = true
    requestAnimationFrame(() => { if (live) { setLoading(true); setError(null) } })
    loadParcels(request).then((rows) => { if (live) setParcels(rows) }).catch((failure) => { if (live) setError(failure) }).finally(() => { if (live) setLoading(false) })
    setOwnerDeletionRights({ status: 'loading', canDeleteOwnedParcels: false })
    loadOwnerParcelDeletionRights(request)
      .then((rights) => {
        if (live) setOwnerDeletionRights({ status: 'ready', ...rights })
      })
      .catch(() => {
        if (live) setOwnerDeletionRights({ status: 'error', canDeleteOwnedParcels: false })
      })
    return () => { live = false }
  }, [request, reloadKey])
  function openEdit(id, trigger) {
    const row = parcels.find((parcel) => parcel.id === id)
    if (!row) return
    editTriggerRef.current = trigger ?? document.activeElement
    setEditDraft(Object.fromEntries(editFields.map((field) => {
      const value = field.key === 'declared_area_m2'
        ? hectaresToSquareMeters(row.declared_area_ha)
        : field.key === 'price_m2'
          ? row.declared_price_m2
          : row[field.key]
      return [field.key, String(value ?? '')]
    })))
    setEditError(null)
    setEditingParcelId(id)
  }
  const closeEdit = useCallback(() => {
    if (savingEdit) return
    setEditingParcelId(null)
    setEditDraft(null)
    setEditError(null)
  }, [savingEdit])
  async function submitEdit() {
    const row = parcels.find((parcel) => parcel.id === editingParcelId)
    if (!row || !editDraft || savingEdit) return
    const changedFields = editFields.filter((field) => {
      const baseline = field.key === 'declared_area_m2'
        ? hectaresToSquareMeters(row.declared_area_ha)
        : field.key === 'price_m2'
          ? row.declared_price_m2
          : row[field.key]
      return editDraft[field.key] !== String(baseline ?? '')
    })
    if (changedFields.length === 0) { closeEdit(); return }
    const pricingChanged = changedFields.some((field) => ['declared_area_m2', 'price_m2', 'currency'].includes(field.key))
    if (pricingChanged && (!isPositiveAreaSquareMeters(editDraft.declared_area_m2)
      || !isPositivePricingDecimal(editDraft.price_m2)
      || estimateParcelTotal(editDraft.declared_area_m2, editDraft.price_m2, editDraft.currency) === null)) {
      setEditError(new Error(lang === 'fr'
        ? 'Une surface déclarée, un prix au m² et une devise valides sont nécessaires pour modifier le prix.'
        : 'Valid declared area, price per m², and currency are required to update pricing.'))
      return
    }
    setSavingEdit(true)
    setEditError(null)
    setError(null)
    setNotice('')
    try {
      const result = await saveParcelFields(request, row.id, changedFields, editDraft)
      if (!result.success) {
        if (result.reconciledRows) setParcels(result.reconciledRows)
        if (result.reconciliationError) setError(result.reconciliationError)
        setEditError(result.error)
        return
      }
      try { setParcels(await loadParcels(request)) } catch { setReloadKey((key) => key + 1) }
      setNotice(lang === 'fr' ? 'Parcelle mise à jour.' : 'Parcel updated.')
      setEditingParcelId(null)
      setEditDraft(null)
    } catch (failure) {
      setEditError(failure)
    } finally {
      setSavingEdit(false)
    }
  }
  function beginAdd() {
    setKmlImportOpen(false)
    setError(null)
    setAddError(null)
    setAddForm(emptyNewParcel())
    setAddStep(1)
    setDraftGeometry(null)
    setResetDrawingKey((key) => key + 1)
    setAddMode(true)
    setError(null)
  }
  function beginKmlImport() {
    setError(null)
    setAddError(null)
    setAddMode(false)
    setDraftGeometry(null)
    setResetDrawingKey((key) => key + 1)
    setKmlImportOpen(true)
  }
  function closeKmlImport() {
    setKmlImportOpen(false)
    setDraftGeometry(null)
    setResetDrawingKey((key) => key + 1)
  }
  function completeKmlImport() {
    setKmlImportOpen(false)
    setDraftGeometry(null)
    setResetDrawingKey((key) => key + 1)
    setSearch('')
    setSelectedParcelId(null)
    setExpandedParcelId(null)
    setReloadKey((key) => key + 1)
    setNotice(lang === 'fr' ? 'Parcelle importée.' : 'Parcel imported.')
  }
  function closeAdd() {
    if (savingAdd) return
    setAddMode(false)
    setAddStep(1)
    setDraftGeometry(null)
    setAddError(null)
    setResetDrawingKey((key) => key + 1)
  }
  async function submitAdd(event) {
    event.preventDefault()
    if (savingAdd) return
    if (addStep === 1) {
      setAddStep(2)
      setAddError(null)
      return
    }
    const invalidControl = findInvalidAddParcelControl(event.currentTarget)
    if (invalidControl) {
      const invalidStep = addParcelStepForField(invalidControl.name)
      setAddStep(invalidStep)
      requestAnimationFrame(() => {
        const control = document.getElementById(`add-parcel-${invalidControl.name}`)
        control?.reportValidity()
      })
      return
    }
    if (!isValidParcelBoundary(draftGeometry)) {
      setAddError(new Error(lang === 'fr' ? 'Draw the parcel boundary on the map first.' : 'Draw the parcel boundary on the map first.'))
      return
    }
    setSavingAdd(true)
    setAddError(null)
    try {
      if (!isPositiveAreaSquareMeters(addForm.declared_area_m2)
        || !isPositivePricingDecimal(addForm.price_m2)
        || estimateParcelTotal(addForm.declared_area_m2, addForm.price_m2, addForm.currency) === null) {
        throw new Error(lang === 'fr'
          ? 'Saisissez une surface déclarée et un prix au m² valides, avec un total positif après arrondi.'
          : 'Enter valid declared area and price per m² values with a positive total after rounding.')
      }
      const response = await createParcel(request, addForm, draftGeometry, user?.email, localBackend)
      if (!response.success) throw new Error(response.message || 'The parcel could not be saved.')
      setAddMode(false)
      setDraftGeometry(null)
      setResetDrawingKey((key) => key + 1)
      setSearch('')
      setReloadKey((key) => key + 1)
      setNotice(lang === 'fr' ? 'Parcelle ajoutée.' : 'Parcel added.')
    } catch (failure) { setAddError(failure) }
    finally { setSavingAdd(false) }
  }
  function beginDeleteParcel(id) {
    if (deletePending || deleteFlightRef.current) return
    setDeleteError(null)
    setDeleteConfirmationId(String(id))
  }
  function cancelDeleteParcel() {
    if (deletePending || deleteFlightRef.current) return
    setDeleteConfirmationId(null)
    setDeleteError(null)
  }
  async function confirmDeleteParcel(id) {
    const parcelId = String(id)
    if (!canShowOwnerParcelDelete({
      rights: ownerDeletionRights,
      parcelId,
      deniedParcelIds: ownerDeletionDeniedIds,
    }) || deletePending || deleteFlightRef.current || deleteConfirmationId !== parcelId) return
    deleteFlightRef.current = true
    setDeletePending(true)
    setDeleteError(null)
    try {
      const deletion = await deleteOwnedParcel(request, parcelId, { confirmed: true })
      const nextState = removeDeletedOwnerParcel({
        parcels, selectedParcelId, expandedParcelId, deleteConfirmationId,
      }, deletion.parcelId)
      setParcels(nextState.parcels)
      setSelectedParcelId(nextState.selectedParcelId)
      setExpandedParcelId(nextState.expandedParcelId)
      setDeleteConfirmationId(nextState.deleteConfirmationId)
      setNotice(lang === 'fr'
        ? 'Parcelle supprimée des listes actives ; sa copie complète reste archivée.'
        : 'Parcel removed from active lists; its complete record remains archived.')
    } catch (failure) {
      setDeleteError(failure)
      if (Number(failure?.status) === 403) {
        setOwnerDeletionDeniedIds((current) => markOwnerParcelDeleteDenied(current, parcelId, failure.status))
        setDeleteConfirmationId(null)
        setOwnerDeletionRights({ status: 'loading', canDeleteOwnedParcels: false })
        setReloadKey((key) => key + 1)
      }
    } finally {
      deleteFlightRef.current = false
      setDeletePending(false)
    }
  }
  async function exportParcels() {
    setError(null)
    try {
      const file = await downloadKml()
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = 'export.kml'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (failure) { setError(failure) }
  }
  function selectParcel(idOrUuid) {
    const row = parcels.find((parcel) => String(parcel.id) === String(idOrUuid) || String(parcel.uuid) === String(idOrUuid))
    if (!row) return
    setSelectedParcelId(row.id)
    setExpandedParcelId(row.id)
    setFocusVersion((version) => version + 1)
  }
  useEffect(() => {
    if (editingParcelId) {
      focusFirstDialogField(editDialogRef.current)
      return undefined
    }
    restoreDialogFocus(editTriggerRef.current)
    editTriggerRef.current = null
    return undefined
  }, [editingParcelId])
  useEffect(() => {
    if (!editingParcelId) return undefined
    const onKeyDown = (event) => {
      handleDialogKeydown(event, editDialogRef.current, closeEdit)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editingParcelId, closeEdit])
  const visibleParcels = parcels
    .filter((row) => !search.trim() || ['parcel_name', 'owner', 'location_name', 'description', 'price', 'price_m2'].some((key) => String(row[key] ?? '').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())))
    .sort((a, b) => {
      if (sort === 'date') {
        const key = ['updated_at', 'updatedAt', 'created_at', 'createdAt'].find((candidate) => a[candidate] != null || b[candidate] != null)
        if (key) return new Date(b[key] ?? 0) - new Date(a[key] ?? 0)
      }
      const order = String(a.parcel_name ?? '').localeCompare(String(b.parcel_name ?? ''), undefined, { sensitivity: 'base' })
      return nameDescending ? -order : order
    })
  const hasParcelDates = parcels.some((row) => ['updated_at', 'updatedAt', 'created_at', 'createdAt'].some((key) => Number.isFinite(Date.parse(row[key] ?? ''))))
  const showOwnerDelete = (parcelId) => canShowOwnerParcelDelete({
    rights: ownerDeletionRights,
    parcelId,
    deniedParcelIds: ownerDeletionDeniedIds,
  })
  return (
    <section className="main-section" aria-labelledby="main-dashboard-title">
      <div className="main-title-card">
        <h1 id="main-dashboard-title">{lang === 'fr' ? 'Opérations foncières' : 'Parcel Operations'}</h1>
        <p>{lang === 'fr' ? 'Aperçu en direct de vos parcelles, tâches et résumés.' : 'Live overview of your parcels, tasks, and overviews.'}</p>
      </div>
      <div className="main-map-card">
        <div className="main-card-header"><h2>{lang === 'fr' ? 'Gestionnaire de données foncières' : 'Field Data Manager'}</h2></div>
        <div className="main-manager-layout">
            {addMode ? <form className="main-add-panel main-parcel-add-form" noValidate onSubmit={(event) => void submitAdd(event)}>
              <div className="main-add-panel-heading"><div><h3>{lang === 'fr' ? 'Ajouter une parcelle' : 'Add New Parcel'}</h3><span className="main-add-step-count" aria-live="polite">{lang === 'fr' ? `Étape ${addStep} sur 2` : `Step ${addStep} of 2`}</span></div><button type="button" aria-label={lang === 'fr' ? 'Fermer' : 'Close'} onClick={closeAdd} disabled={savingAdd}><Icon name="close" size={16}/></button></div>
              <p className="main-add-help">{draftGeometry ? (lang === 'fr' ? 'Contour dessiné. Complétez les informations puis validez.' : 'Boundary drawn. Complete the details and save.') : (lang === 'fr' ? 'Vous pouvez dessiner le contour sur la carte maintenant ou avant de valider.' : 'You can draw the parcel boundary on the map now or before saving.')}</p>
              <div className="main-add-step-fields" hidden={addStep !== 1} aria-hidden={addStep !== 1}>
                <label htmlFor="add-parcel-parcel_name">{lang === 'fr' ? 'Nom de la parcelle' : 'Parcel name'}<input id="add-parcel-parcel_name" name="parcel_name" required value={addForm.parcel_name} onChange={(event) => setAddForm((current) => ({ ...current, parcel_name: event.target.value }))} /></label>
                {localBackend && <label htmlFor="add-parcel-owner">{lang === 'fr' ? 'Propriétaire' : 'Owner'}<input id="add-parcel-owner" name="owner" required value={addForm.owner} onChange={(event) => setAddForm((current) => ({ ...current, owner: event.target.value }))} /></label>}
                <label htmlFor="add-parcel-location_name">{lang === 'fr' ? 'Localisation' : 'Location'}<input id="add-parcel-location_name" name="location_name" required value={addForm.location_name} onChange={(event) => setAddForm((current) => ({ ...current, location_name: event.target.value }))} /></label>
                <label htmlFor="add-parcel-description">{lang === 'fr' ? 'Description' : 'Description'}<textarea id="add-parcel-description" name="description" required rows="2" value={addForm.description} onChange={(event) => setAddForm((current) => ({ ...current, description: event.target.value }))} /></label>
              </div>
              <div className="main-add-step-fields" hidden={addStep !== 2} aria-hidden={addStep !== 2}>
                <div className="main-add-grid">
                  <label htmlFor="add-parcel-declared_area_m2">{lang === 'fr' ? 'Surface d\u00e9clar\u00e9e (m\u00b2)' : 'Declared area (m\u00b2)'}<input id="add-parcel-declared_area_m2" name="declared_area_m2" required type="number" min="0.0001" step="0.0001" value={addForm.declared_area_m2} onChange={(event) => setAddForm((current) => ({ ...current, declared_area_m2: event.target.value }))} /></label>
                  <label htmlFor="add-parcel-price_m2">{lang === 'fr' ? 'Prix déclaré / m²' : 'Declared price / m²'}<input id="add-parcel-price_m2" name="price_m2" required type="number" min="0.00000001" step="0.00000001" value={addForm.price_m2} onChange={(event) => setAddForm((current) => ({ ...current, price_m2: event.target.value }))} /></label>
                </div>
                <p className="main-add-estimate" role="status">{lang === 'fr' ? 'Estimation avant validation par le serveur :' : 'Estimate before server validation:'} {estimateParcelTotal(addForm.declared_area_m2, addForm.price_m2, addForm.currency) ?? '—'} {addForm.currency}</p>
                <label htmlFor="add-parcel-currency">{lang === 'fr' ? 'Devise' : 'Currency'}<select id="add-parcel-currency" name="currency" required value={addForm.currency} onChange={(event) => setAddForm((current) => ({ ...current, currency: event.target.value }))}>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label>
                <div className="main-add-grid">
                  <label htmlFor="add-parcel-sell_category">{lang === 'fr' ? 'Statut de vente' : 'Sale status'}<select id="add-parcel-sell_category" name="sell_category" required value={addForm.sell_category} onChange={(event) => setAddForm((current) => ({ ...current, sell_category: event.target.value }))}><option value="to_sell">{lang === 'fr' ? 'À vendre' : 'For sale'}</option><option value="vendu">{lang === 'fr' ? 'Vendue' : 'Sold'}</option><option value="autre">{lang === 'fr' ? 'Autre' : 'Other'}</option><option value="na">#NA</option></select></label>
                  <label htmlFor="add-parcel-status_category">{lang === 'fr' ? 'Statut du titre' : 'Title status'}<select id="add-parcel-status_category" name="status_category" required value={addForm.status_category} onChange={(event) => setAddForm((current) => ({ ...current, status_category: event.target.value }))}><option value="">—</option>{PARCEL_STATUS_OPTIONS.status_category.map((option) => <option key={option.value} value={option.value}>{option[lang]}</option>)}</select></label>
                </div>
              </div>
              {addError && <p className="main-add-error" role="alert">{apiErrorMessage(addError, lang) || addError.message || (lang === 'fr' ? 'Échec de l’ajout.' : 'Unable to add parcel.')}</p>}
              <div className="main-add-actions">
                <button type="button" onClick={closeAdd} disabled={savingAdd}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
                {addStep === 1
                  ? <button type="submit" disabled={savingAdd}>{lang === 'fr' ? 'Suivant' : 'Next'}</button>
                  : <><button type="button" onClick={() => { setAddStep(1); setAddError(null) }} disabled={savingAdd}>{lang === 'fr' ? 'Retour' : 'Back'}</button><button type="submit" disabled={savingAdd}>{savingAdd ? (lang === 'fr' ? 'Enregistrement…' : 'Saving…') : (lang === 'fr' ? 'Valider' : 'Save')}</button></>}
              </div>
            </form> : kmlImportOpen ? <KmlImport layout="manager-column" request={request} userEmail={user?.email} localBackend={localBackend} lang={lang} onClose={closeKmlImport} onImported={completeKmlImport} /> :
          <aside className="main-parcel-sidebar" aria-label={lang === 'fr' ? 'Gestion des parcelles' : 'Parcel manager'}>
            <div className="main-sidebar-heading"><h3>{lang === 'fr' ? 'Gestionnaire de parcelles' : 'Parcel Manager'}</h3><span>{loading ? '…' : parcels.length}</span></div>
            {ownerDeletionRights.status === 'loading' && <p className="main-rights-state" role="status">{lang === 'fr' ? 'Vérification du droit de suppression…' : 'Checking parcel deletion rights…'}</p>}
            {ownerDeletionRights.status === 'error' && <div className="main-rights-state main-list-error" role="alert"><p>{lang === 'fr' ? 'Le droit de suppression est indisponible ; l’action reste masquée.' : 'Deletion rights are unavailable; the action remains hidden.'}</p><button type="button" onClick={() => setReloadKey((key) => key + 1)}>{lang === 'fr' ? 'Réessayer' : 'Retry'}</button></div>}
            {ownerDeletionRights.status === 'ready' && <p className="main-rights-state" aria-live="polite">{effectiveOfferSummary(ownerDeletionRights, lang)}</p>}
            {deleteError && deleteConfirmationId === null && <p className="main-parcel-delete-error" role="alert">{parcelDeletionErrorMessage(deleteError, lang, 'pro')}</p>}
            <div className="main-actions">
              <button type="button" onClick={beginAdd}>{lang === 'fr' ? 'Ajouter' : 'Add'}</button>
              <button type="button" onClick={beginKmlImport}>{lang === 'fr' ? 'Importer KML' : 'Import KML'}</button>
              <button type="button" disabled={!selectedParcelId} onClick={(event) => openEdit(selectedParcelId, event.currentTarget)}>{lang === 'fr' ? 'Modifier' : 'Edit'}</button>
              <button type="button" onClick={() => void exportParcels()}>{lang === 'fr' ? 'Exporter' : 'Export'}</button>
            </div>
            <label className="main-search"><span className="sr-only">{lang === 'fr' ? 'Rechercher une parcelle' : 'Search parcels'}</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={lang === 'fr' ? 'Rechercher…' : 'Search parcels…'} /></label>
            <div className="main-sort-row"><span>{MAIN_LABELS.filter[lang]}</span><button type="button" className={`main-sort-pill${sort === 'date' ? ' is-selected' : ''}`} disabled={!hasParcelDates} aria-pressed={sort === 'date'} onClick={() => setSort((current) => current === 'date' ? 'name' : 'date')}>Date <Icon name={sort === 'date' ? 'arrow-down' : 'arrow-up'} size={12}/></button><button type="button" className={`main-sort-pill${sort === 'name' ? ' is-selected' : ''}`} aria-pressed={sort === 'name'} onClick={() => { setSort('name'); setNameDescending((current) => !current) }}>{nameDescending ? 'Z–A' : 'A–Z'}</button></div>
            {loading && <p className="main-list-state" role="status">{lang === 'fr' ? 'Chargement…' : 'Loading parcels…'}</p>}
            {error && <div className="main-list-state main-list-error" role="alert"><p>{apiErrorMessage(error, lang) || error.message || (lang === 'fr' ? 'Impossible de charger les parcelles.' : 'Unable to load parcels.')}</p><button type="button" onClick={() => setReloadKey((key) => key + 1)}>{lang === 'fr' ? 'Réessayer' : 'Try again'}</button></div>}
            {notice && <p className="main-notice" role="status">{notice}</p>}
            {!loading && !error && parcels.length === 0 && <p className="main-list-state">{lang === 'fr' ? 'Aucune parcelle associée à ce compte.' : 'No parcels are associated with this account.'}</p>}
            {!loading && !error && parcels.length > 0 && visibleParcels.length === 0 && <p className="main-list-state">{lang === 'fr' ? 'Aucun résultat pour cette recherche.' : 'No parcels match this search.'}</p>}
            <div className="main-parcel-list">
              {visibleParcels.map((row) => <article className={`main-parcel-card${selectedParcelId === row.id ? ' is-selected' : ''}`} key={row.id}>
                <button className="main-parcel-summary" type="button" onClick={() => { setSelectedParcelId(row.id); setFocusVersion((version) => version + 1); setExpandedParcelId((current) => current === row.id ? null : row.id) }} aria-expanded={expandedParcelId === row.id} aria-pressed={selectedParcelId === row.id}>
                  <span className="main-parcel-mark" aria-hidden="true">{(row.parcel_name || 'P').slice(0, 1).toUpperCase()}</span>
                  <span className="main-parcel-copy"><strong>{row.parcel_name || (lang === 'fr' ? 'Parcelle sans nom' : 'Unnamed parcel')}</strong><small>{row.location_name || row.owner || '—'}</small>{row.admin_visibility_hidden && <small className="main-parcel-hidden-note">{lang === 'fr' ? 'Masquée par l’administration' : 'Hidden by admin'}</small>}</span>
                  <span className="main-parcel-status">{parcelStatusLabel('status_category', row.status_category, lang)}</span>
                </button>
                {expandedParcelId === row.id && <>
                <dl className="main-parcel-details">
                  <div><dt>{fieldLabels.parcel_name[lang]}</dt><dd>{row.parcel_name || '—'}</dd></div>
                  <div><dt>{ownerLabel[lang]}</dt><dd>{row.owner || '—'}</dd></div>
                  <div><dt>{fieldLabels.location_name[lang]}</dt><dd>{row.location_name || '—'}</dd></div>
                    <>
                    <div><dt>{lang === 'fr' ? 'Surface d\u00e9clar\u00e9e (m\u00b2)' : 'Declared area (m\u00b2)'}</dt><dd>{row.declared_area_ha == null ? (lang === 'fr' ? 'Surface déclarée non renseignée' : 'Declared area not provided') : formatAreaSquareMeters(row.declared_area_ha, lang === 'fr' ? 'fr-FR' : 'en-US')}</dd></div>
                    <div><dt>{lang === 'fr' ? 'Prix au m²' : 'Price per m²'}</dt><dd>{row.declared_price_m2 == null ? `${row.price_m2 ?? '—'} ${row.currency || ''} (${lang === 'fr' ? 'historique' : 'historical'})` : `${row.declared_price_m2} ${row.currency || ''}`}</dd></div>
                    <div><dt>{row.price_source === 'calculated' ? (lang === 'fr' ? 'Prix total calculé' : 'Calculated total price') : (lang === 'fr' ? 'Prix historique (non recalculé)' : 'Historical price (not recalculated)')}</dt><dd>{row.price ?? '—'} {row.currency || ''}</dd></div>
                    </>
                  <div className="main-parcel-description"><dt>{fieldLabels.description[lang]}</dt><dd>{row.description || '—'}</dd></div>
                  <div><dt>{fieldLabels.sell_category[lang]}</dt><dd>{parcelStatusLabel('sell_category', row.sell_category, lang)}</dd></div>
                  {row.admin_visibility_hidden && <div><dt>{lang === 'fr' ? 'Visibilité Marketplace' : 'Marketplace visibility'}</dt><dd>{lang === 'fr' ? 'Masquée par l’administration' : 'Hidden by admin'}</dd></div>}
                  <div><dt>{fieldLabels.status_category[lang]}</dt><dd>{parcelStatusLabel('status_category', row.status_category, lang)}</dd></div>
                </dl>
                {showOwnerDelete(row.id) && <div className="main-parcel-delete-wrap">
                  {String(deleteConfirmationId) === String(row.id)
                    ? <div className="main-parcel-delete-confirm" role="group" aria-labelledby={`owner-delete-title-${row.id}`}>
                      <h4 id={`owner-delete-title-${row.id}`}>{lang === 'fr' ? 'Confirmer la suppression' : 'Confirm deletion'}</h4>
                      <p>{lang === 'fr'
                        ? 'Cette parcelle sera retirée des listes actives. Sa copie complète et l’identité de l’auteur resteront dans les archives protégées. Cette action ne peut pas être annulée depuis l’application.'
                        : 'This parcel will be removed from active lists. Its complete record and the actor identity will remain in the protected archive. This action cannot be undone in the app.'}</p>
                      {deleteError && <p className="main-parcel-delete-error" role="alert">{parcelDeletionErrorMessage(deleteError, lang, 'pro')}</p>}
                      <div className="main-parcel-delete-actions">
                        <button type="button" disabled={deletePending} onClick={cancelDeleteParcel}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</button>
                        <button type="button" className="is-danger" disabled={deletePending} onClick={() => void confirmDeleteParcel(row.id)}>{deletePending ? (lang === 'fr' ? 'Suppression…' : 'Deleting…') : (lang === 'fr' ? 'Confirmer la suppression' : 'Confirm deletion')}</button>
                      </div>
                    </div>
                    : <>
                      <button className="main-parcel-delete-button" type="button" disabled={deletePending} onClick={() => beginDeleteParcel(row.id)}>{lang === 'fr' ? 'Supprimer la parcelle' : 'Delete parcel'}</button>
                    </>}
                </div>}
                </>}
              </article>)}
            </div>
          </aside>}
          <div className="main-map-wrap">
            <ParcelMap parcels={parcels} selectedParcel={parcels.find((row) => row.id === selectedParcelId) || null} focusVersion={focusVersion} onSelectParcel={selectParcel} onGeometryComplete={setDraftGeometry} resetDrawingKey={resetDrawingKey} lang={lang} onError={setError} />
          </div>
        </div>
      </div>
      {editingParcelId && editDraft && (() => {
        const row = parcels.find((parcel) => parcel.id === editingParcelId)
        if (!row) return null
        return <div className="main-edit-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEdit() }}>
          <section ref={editDialogRef} className="main-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="main-edit-title" tabIndex={-1}>
            <button className="main-edit-close" type="button" aria-label={lang === 'fr' ? 'Fermer' : 'Close'} disabled={savingEdit} onClick={closeEdit}><Icon name="close" size={18}/></button>
            <h2 id="main-edit-title">{lang === 'fr' ? 'Modifier la parcelle' : 'Edit Parcel'}</h2>
            <div className="main-edit-table-wrap"><table className="main-edit-table"><thead><tr>{editFields.map((field) => <th key={field.key} scope="col">{field[lang]}</th>)}</tr></thead><tbody><tr>{editFields.map((field) => <td key={field.key}><ParcelCell row={row} field={field} lang={lang} value={editDraft[field.key]} disabled={savingEdit} onChange={(value) => setEditDraft((current) => ({ ...current, [field.key]: value }))} /></td>)}</tr></tbody></table></div>
            <p className="main-add-estimate">{row.price_source === 'calculated' ? (lang === 'fr' ? 'Prix total calculé' : 'Calculated total price') : (lang === 'fr' ? 'Prix historique (non recalculé)' : 'Historical price (not recalculated)')}: {row.price ?? '—'} {row.currency || ''}</p>
            {editError && <p className="main-edit-error" role="alert">{apiErrorMessage(editError, lang) || editError.message || (lang === 'fr' ? 'Échec de l’enregistrement.' : 'Unable to save parcel changes.')}</p>}
            <button className="main-edit-submit" type="button" disabled={savingEdit} onClick={() => void submitEdit()}>{savingEdit ? (lang === 'fr' ? 'Enregistrement…' : 'Saving…') : (lang === 'fr' ? 'Valider' : 'Save')}</button>
          </section>
        </div>
      })()}
    </section>
  )
}

export default function Main() {
  const { logout, request, user, status, error } = useAuth()
  const localBackend = isLocalBackendConfigured()
  const [tab, setTab] = useState(readTab)
  const [accountPage, setAccountPage] = useState(readAccountPage)
  const [lang, setLang] = useState(readLanguage)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef(null)
  const accountMenuTriggerRef = useRef(null)
  const assistantTriggerRef = useRef(null)
  const [assistantPanel, setAssistantPanel] = useState(null)
  const [assistantAccess, setAssistantAccess] = useState({ status: 'loading', allowed: false })
  const [assistantAccessRefresh, setAssistantAccessRefresh] = useState(0)
  const [supportRequestOpen, setSupportRequestOpen] = useState(false)
  const assistantAvailable = status === 'authenticated' && Boolean(user) &&
    assistantAccess.status === 'ready' && assistantAccess.allowed
  const labels = ACCOUNT_LABELS[lang]
  const displayName = accountDisplayName(user)

  useEffect(() => {
    let active = true
    let expiryTimer = null

    async function checkAssistantAccess() {
      if (status !== 'authenticated' || !user) {
        setAssistantAccess({ status: 'unavailable', allowed: false })
        setAssistantPanel(null)
        return
      }
      setAssistantAccess({ status: 'loading', allowed: false })
      try {
        const offer = await loadAccountOffer(request, { localBackend })
        if (!active) return
        const allowed = hasEffectiveLocalProAssistantAccess(offer)
        setAssistantAccess({ status: 'ready', allowed })
        if (!allowed) setAssistantPanel(null)
        if (allowed && offer.period?.ends_at) {
          const expiresIn = Date.parse(offer.period.ends_at) - Date.now()
          if (Number.isFinite(expiresIn) && expiresIn >= 0) {
            expiryTimer = window.setTimeout(checkAssistantAccess, Math.min(expiresIn + 50, 2_147_000_000))
          }
        }
      } catch {
        if (!active) return
        setAssistantAccess({ status: 'error', allowed: false })
        setAssistantPanel(null)
      }
    }

    void checkAssistantAccess()
    const refreshWhenFocused = () => {
      if (expiryTimer !== null) window.clearTimeout(expiryTimer)
      void checkAssistantAccess()
    }
    window.addEventListener('focus', refreshWhenFocused)
    return () => {
      active = false
      if (expiryTimer !== null) window.clearTimeout(expiryTimer)
      window.removeEventListener('focus', refreshWhenFocused)
    }
  }, [assistantAccessRefresh, localBackend, request, status, user])

  const openAssistant = useCallback((context = null, trigger = null) => {
    if (!assistantAvailable) return
    assistantTriggerRef.current = trigger ?? document.activeElement
    const parcelId = context?.parcelId
    setAssistantPanel({
      context: parcelId == null ? null : {
        parcelId,
        parcelName: typeof context.parcelName === 'string' ? context.parcelName : '',
      },
    })
  }, [assistantAvailable])
  const closeAssistant = useCallback(() => setAssistantPanel(null), [])
  const closeSupportRequest = useCallback(() => setSupportRequestOpen(false), [])
  const contactSupportFromAssistant = useCallback(() => {
    setAssistantPanel(null)
    window.history.pushState(null, '', '/main#tasks')
    setTab('tasks')
    setAccountPage(null)
    setAccountMenuOpen(false)
    setSupportRequestOpen(true)
  }, [])

  useEffect(() => {
    const sync = () => { setTab(readTab()); setAccountPage(readAccountPage()) }
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync) }
  }, [])

  useEffect(() => {
    if (!accountMenuOpen) return undefined
    const onPointerDown = (event) => {
      if (isOutsideAccountMenu(event.target, accountMenuRef.current)) setAccountMenuOpen(false)
    }
    const onKeyDown = (event) => {
      if (!isAccountMenuEscape(event.key)) return
      setAccountMenuOpen(false)
      accountMenuTriggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [accountMenuOpen])

  useEffect(() => {
    const title = accountPage
      ? accountPage === 'profile' ? labels.profileTitle : labels.offerTitle
      : tab === 'dashboard' ? 'Dashboard' : pages[tab]?.[lang]?.[0] || 'Tany'
    applyPageMetadata('main', lang, { title: `${title} | Tany` })
    writeLanguage(lang)
  }, [tab, accountPage, lang, labels])

  function switchTab(event, next) {
    event.preventDefault()
    window.history.pushState(null, '', next === 'dashboard' ? '/main' : `/main#${next}`)
    setTab(next)
    setAccountPage(null)
    setAccountMenuOpen(false)
  }

  function openAccountPage(event, page) {
    event.preventDefault()
    window.history.pushState(null, '', accountPageHash(page))
    setTab('dashboard')
    setAccountPage(page)
    setAccountMenuOpen(false)
  }

  function returnToParcels(event) {
    event.preventDefault()
    window.history.pushState(null, '', '/main')
    setTab('dashboard')
    setAccountPage(null)
  }

  async function signOut() {
    await logout()
    window.location.replace('/signin')
  }

  const nav = () => tabs.map((item) => <a key={item.id} href={item.id === 'dashboard' ? '/main' : `/main#${item.id}`} aria-current={!accountPage && tab === item.id ? 'page' : undefined} className={!accountPage && tab === item.id ? 'is-active' : ''} onClick={(event) => switchTab(event, item.id)}><span className="main-nav-icon"><Icon name={item.icon} size={17}/></span><span>{item[lang]}</span></a>)
  return <div className={`main-page${tab === 'crops' ? ' main-page-marketplace' : ''}`}>
    <header className="main-header"><div className="main-header-inner">
      <a className="main-brand" href="/" aria-label="Tany Landtrust, home"><span className="main-brand-name">tany Landtrust</span></a>
      <nav className="main-desktop-nav" aria-label={lang === 'fr' ? 'Navigation principale' : 'Main navigation'}>{nav()}</nav>
      <div className="main-header-actions">
        <details className="main-language-menu">
            <summary aria-label={MAIN_LABELS.languageMenu[lang]}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>
            <span>{lang.toUpperCase()}</span><i aria-hidden="true" />
          </summary>
          <div className="main-language-options" role="group" aria-label={MAIN_LABELS.switchLanguage[lang]}>
            {['en', 'fr'].map((language) => <button key={language} type="button" lang={language} aria-pressed={lang === language} onClick={(event) => { setLang(language); event.currentTarget.closest('details')?.removeAttribute('open') }}>{language.toUpperCase()}</button>)}
          </div>
        </details>
          {assistantAvailable && <button className="main-assistant-trigger" type="button" aria-label={lang === 'fr' ? 'Ouvrir l’assistant IA' : 'Open AI assistant'} title={lang === 'fr' ? 'Ouvrir l’assistant IA' : 'Open AI assistant'} onClick={(event) => openAssistant(null, event.currentTarget)}>
            <Icon name="sparkles" size={18}/>
          <span className="main-assistant-label">{lang === 'fr' ? 'Assistant IA' : 'AI assistant'}</span>
          </button>}
        <div className="main-account-menu" ref={accountMenuRef}>
          <button
            ref={accountMenuTriggerRef}
            className="main-account-trigger"
            type="button"
            aria-expanded={accountMenuOpen}
            aria-controls="main-account-panel"
            aria-label={`${labels.menu}: ${displayName}`}
            onClick={() => setAccountMenuOpen((open) => !open)}
          >
            <span className="main-account-initials" aria-hidden="true">CL</span>
            <span className="main-account-name">{lang === 'fr' ? 'Compte' : 'Account'}</span>
            <span className={`main-account-chevron${accountMenuOpen ? ' is-open' : ''}`} aria-hidden="true" />
          </button>
          <div className="main-account-panel" id="main-account-panel" role="region" aria-label={labels.menu} hidden={!accountMenuOpen}>
            <div className="main-account-identity">
              <strong>{displayName}</strong>
              {user?.email && user.email !== displayName && <span>{user.email}</span>}
            </div>
            <nav className="main-account-links" aria-label={labels.menu}>
              <a href={accountPageHash('profile')} onClick={(event) => openAccountPage(event, 'profile')}>{labels.profile}</a>
              <a href={accountPageHash('offer')} onClick={(event) => openAccountPage(event, 'offer')}>{labels.offer}</a>
            </nav>
            <div className="main-account-footer">
              <button type="button" onClick={() => void signOut()} disabled={status === 'signingOut'}>
                {status === 'signingOut' ? '…' : labels.logout}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div></header>
    <main className={`main-content${tab === 'crops' ? ' main-content-marketplace' : ''}`}>{accountPage
      ? <AccountPage page={accountPage} lang={lang} request={request} localBackend={isLocalBackendConfigured()} onBack={returnToParcels}/>
      : tab === 'dashboard' ? <Dashboard lang={lang} /> : tab === 'crops' ? <Marketplace lang={lang} onOpenAssistant={assistantAvailable ? openAssistant : undefined} /> : tab === 'tasks' ? <Chat lang={lang} supportRequestOpen={supportRequestOpen} onCloseSupportRequest={closeSupportRequest} /> : <LandLaw lang={lang} />}{error && <p className="main-feedback main-error" role="status">{apiErrorMessage(error, lang) || error.message}</p>}</main>
    {assistantPanel && assistantAvailable && <AssistantPanel
      key={assistantConversationKey(assistantPanel.context?.parcelId ?? null)}
      lang={lang}
      context={assistantPanel.context}
      triggerRef={assistantTriggerRef}
      onClose={closeAssistant}
      onContactSupport={contactSupportFromAssistant}
      onAccessDenied={() => {
        setAssistantAccess({ status: 'loading', allowed: false })
        setAssistantAccessRefresh((value) => value + 1)
      }}
    />}
    <nav className="main-mobile-nav" aria-label={lang === 'fr' ? 'Navigation mobile' : 'Mobile navigation'}>{nav()}</nav>
  </div>
}
