import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth.js'
import { loadParcels, saveParcelField } from './mainData.js'
import { checkParcelLimit, makeParcelPayload } from './parcelMapData.js'
import ParcelMap from './ParcelMap.jsx'
import Marketplace from './Marketplace.jsx'
import './Main.css'

const tabs = [
  { id: 'dashboard', icon: '◫', en: 'Parcel', fr: 'Parcelle' },
  { id: 'crops', icon: '▣', en: 'Market Place', fr: 'Marché' },
  { id: 'tasks', icon: '▤', en: 'Message', fr: 'Message' },
  { id: 'yields', icon: '§', en: 'Land law', fr: 'Droit foncier' },
]

const pages = {
  crops: { file: 'main_market.html', en: ['Market Place', 'Browse listings, buy, and sell produce directly.'], fr: ['Marché', 'Parcourez les annonces, achetez et vendez directement.'] },
  tasks: { file: 'chat.html', en: ['Private Message', 'Communicate securely with your network.'], fr: ['Messages privés', 'Communiquez en toute sécurité avec votre réseau.'] },
  yields: { file: 'legal.html', en: ['Land Law', ''], fr: ['Droit foncier', ''] },
}

const fields = [
  { key: 'owner', en: 'Owner', fr: 'Propriétaire' },
  { key: 'parcel_name', en: 'Parcel name', fr: 'Nom de la parcelle' },
  { key: 'price_m2', en: 'Price / m²', fr: 'Prix / m²', type: 'number' },
  { key: 'price', en: 'Price', fr: 'Prix', type: 'number' },
  { key: 'location_name', en: 'Location', fr: 'Localisation' },
  { key: 'description', en: 'Description', fr: 'Description' },
  { key: 'sell_category', en: 'Sale status', fr: 'Statut de vente', options: [['to_sell', 'À vendre | to sell'], ['vendu', 'Vendue | Sold'], ['autre', 'Autre | other'], ['na', '#NA']] },
  { key: 'status_category', en: 'Title status', fr: 'Statut du titre', options: [['titre', 'Titre | Title deed'], ['titre_borne', 'Titre et borne | Property title'], ['kt', 'Karan-tany | Land certificate'], ['na', '#NA']] },
]

const currencies = ['USD', 'EUR', 'KES', 'TZS', 'UGX', 'RWF', 'BIF', 'SOS', 'ETB', 'DJF', 'EGP', 'SDG', 'SSP', 'MGA']
const emptyNewParcel = () => ({ owner: '', parcel_name: '', price_m2: '0', price: '', currency: 'USD', location_name: '', description: '', sell_category: 'to_sell', status_category: '' })

function readTab() {
  const hash = window.location.hash.slice(1)
  return tabs.some((tab) => tab.id === hash) ? hash : 'dashboard'
}

function readLanguage() {
  try { return (localStorage.getItem('language') ?? localStorage.getItem('tany.home.lang')) === 'fr' ? 'fr' : 'en' }
  catch { return 'en' }
}

function legacyUrl(file) {
  return new URL(`/legacy/${file}`, window.location.origin).href
}

function ParcelCell({ row, field, lang, value, onChange, disabled }) {

  const label = `${field[lang]}, ${row.parcel_name || row.id}`
  if (field.options) return (
    <select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {!field.options.some(([option]) => option === value) && <option value={value}>{value || '—'}</option>}
      {field.options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
    </select>
  )
  return <input aria-label={label} type={field.type || 'text'} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
}

function Dashboard({ lang }) {
  const { request, user, downloadKml } = useAuth()
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
  const [addMode, setAddMode] = useState(false)
  const [addForm, setAddForm] = useState(emptyNewParcel)
  const [draftGeometry, setDraftGeometry] = useState(null)
  const [savingAdd, setSavingAdd] = useState(false)
  const [addError, setAddError] = useState(null)
  const [resetDrawingKey, setResetDrawingKey] = useState(0)
  useEffect(() => {
    let live = true
    requestAnimationFrame(() => { if (live) { setLoading(true); setError(null) } })
    loadParcels(request).then((rows) => { if (live) setParcels(rows) }).catch((failure) => { if (live) setError(failure) }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [request, reloadKey])
  function openEdit(id) {
    const row = parcels.find((parcel) => parcel.id === id)
    if (!row) return
    setEditDraft(Object.fromEntries(fields.map((field) => [field.key, String(row[field.key] ?? '')])))
    setEditError(null)
    setEditingParcelId(id)
  }
  function closeEdit() {
    if (savingEdit) return
    setEditingParcelId(null)
    setEditDraft(null)
    setEditError(null)
  }
  async function submitEdit() {
    const row = parcels.find((parcel) => parcel.id === editingParcelId)
    if (!row || !editDraft || savingEdit) return
    const changedFields = fields.filter((field) => editDraft[field.key] !== String(row[field.key] ?? ''))
    if (changedFields.length === 0) { closeEdit(); return }
    setSavingEdit(true)
    setEditError(null)
    setError(null)
    setNotice('')
    try {
      for (const field of changedFields) await saveParcelField(request, row.id, field.key, editDraft[field.key])
      setParcels((current) => current.map((parcel) => parcel.id === row.id ? { ...parcel, ...editDraft } : parcel))
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
    setError(null)
    setAddError(null)
    setAddForm(emptyNewParcel())
    setDraftGeometry(null)
    setResetDrawingKey((key) => key + 1)
    setAddMode(true)
    setError(null)
  }
  function closeAdd() {
    if (savingAdd) return
    setAddMode(false)
    setDraftGeometry(null)
    setAddError(null)
    setResetDrawingKey((key) => key + 1)
  }
  async function submitAdd(event) {
    event.preventDefault()
    if (savingAdd) return
    if (loading || error) {
      setAddError(new Error(lang === 'fr' ? 'Impossible de vérifier le nombre actuel de parcelles.' : 'Cannot verify the current parcel count.'))
      return
    }
    if (!draftGeometry) {
      setAddError(new Error(lang === 'fr' ? 'Draw the parcel boundary on the map first.' : 'Draw the parcel boundary on the map first.'))
      return
    }
    setSavingAdd(true)
    setAddError(null)
    try {
      const latestParcels = await loadParcels(request)
      setParcels(latestParcels)
      const account = await request('/account')
      const quota = checkParcelLimit(account, latestParcels.length)
      if (!quota.allowed) throw new Error(`The ${quota.plan} plan limit of ${quota.limit} parcels has been reached.`)
      const payload = makeParcelPayload(addForm, draftGeometry.geometry, user?.email, draftGeometry.centroid, draftGeometry.areaHa)
      const response = await request('/parcels_w', { method: 'POST', body: JSON.stringify(payload) })
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
    if (!editingParcelId) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !savingEdit) {
        setEditingParcelId(null)
        setEditDraft(null)
        setEditError(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editingParcelId, savingEdit])
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
  return (
    <section className="main-section" aria-labelledby="main-dashboard-title">
      <div className="main-title-card">
        <h1 id="main-dashboard-title">{lang === 'fr' ? 'Opérations foncières' : 'Parcel Operations'}</h1>
        <p>{lang === 'fr' ? 'Aperçu en direct de vos parcelles, tâches et résumés.' : 'Live overview of your parcels, tasks, and overviews.'}</p>
      </div>
      <div className="main-map-card">
        <div className="main-card-header"><h2>{lang === 'fr' ? 'Gestionnaire de données foncières' : 'Field Data Manager'}</h2></div>
        <div className="main-manager-layout">
          <aside className="main-parcel-sidebar" aria-label={lang === 'fr' ? 'Gestion des parcelles' : 'Parcel manager'}>
            <div className="main-sidebar-heading"><h3>{lang === 'fr' ? 'Gestionnaire de parcelles' : 'Parcel Manager'}</h3><span>{loading ? '…' : parcels.length}</span></div>
            <div className="main-actions">
              <button type="button" onClick={beginAdd}>{lang === 'fr' ? 'Ajouter' : 'Add'}</button>
              <button type="button" disabled={!selectedParcelId} onClick={() => openEdit(selectedParcelId)}>{lang === 'fr' ? 'Modifier' : 'Edit'}</button>
              <button type="button" onClick={() => void exportParcels()}>{lang === 'fr' ? 'Exporter' : 'Export'}</button>
            </div>
            <label className="main-search"><span className="sr-only">{lang === 'fr' ? 'Rechercher une parcelle' : 'Search parcels'}</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={lang === 'fr' ? 'Rechercher…' : 'Search parcels…'} /></label>
            <div className="main-sort-row"><span>{lang === 'fr' ? 'Filtre :' : 'Filter:'}</span><button type="button" className={`main-sort-pill${sort === 'date' ? ' is-selected' : ''}`} disabled={!hasParcelDates} aria-pressed={sort === 'date'} onClick={() => setSort((current) => current === 'date' ? 'name' : 'date')}>Date {sort === 'date' ? '⌄' : '↑'}</button><button type="button" className={`main-sort-pill${sort === 'name' ? ' is-selected' : ''}`} aria-pressed={sort === 'name'} onClick={() => { setSort('name'); setNameDescending((current) => !current) }}>{nameDescending ? 'Z–A' : 'A–Z'}</button></div>
            {loading && <p className="main-list-state" role="status">{lang === 'fr' ? 'Chargement…' : 'Loading parcels…'}</p>}
            {error && <div className="main-list-state main-list-error" role="alert"><p>{error.message || (lang === 'fr' ? 'Impossible de charger les parcelles.' : 'Unable to load parcels.')}</p><button type="button" onClick={() => setReloadKey((key) => key + 1)}>{lang === 'fr' ? 'Réessayer' : 'Try again'}</button></div>}
            {notice && <p className="main-notice" role="status">{notice}</p>}
            {!loading && !error && parcels.length === 0 && <p className="main-list-state">{lang === 'fr' ? 'Aucune parcelle associée à ce compte.' : 'No parcels are associated with this account.'}</p>}
            {!loading && !error && parcels.length > 0 && visibleParcels.length === 0 && <p className="main-list-state">{lang === 'fr' ? 'Aucun résultat pour cette recherche.' : 'No parcels match this search.'}</p>}
            <div className="main-parcel-list">
              {visibleParcels.map((row) => <article className={`main-parcel-card${selectedParcelId === row.id ? ' is-selected' : ''}`} key={row.id}>
                <button className="main-parcel-summary" type="button" onClick={() => { setSelectedParcelId(row.id); setFocusVersion((version) => version + 1); setExpandedParcelId((current) => current === row.id ? null : row.id) }} aria-expanded={expandedParcelId === row.id} aria-pressed={selectedParcelId === row.id}>
                  <span className="main-parcel-mark" aria-hidden="true">{(row.parcel_name || 'P').slice(0, 1).toUpperCase()}</span>
                  <span className="main-parcel-copy"><strong>{row.parcel_name || (lang === 'fr' ? 'Parcelle sans nom' : 'Unnamed parcel')}</strong><small>{row.location_name || row.owner || '—'}</small></span>
                  <span className="main-parcel-status">{row.status_category || '—'}</span>
                </button>
                {expandedParcelId === row.id && <dl className="main-parcel-details">
                  <div><dt>{fields[1][lang]}</dt><dd>{row.parcel_name || '—'}</dd></div>
                  <div><dt>{fields[0][lang]}</dt><dd>{row.owner || '—'}</dd></div>
                  <div><dt>{fields[4][lang]}</dt><dd>{row.location_name || '—'}</dd></div>
                  <div><dt>{fields[2][lang]}</dt><dd>{row.price_m2 ?? '—'}</dd></div>
                  <div><dt>{fields[3][lang]}</dt><dd>{row.price ?? '—'}</dd></div>
                  <div className="main-parcel-description"><dt>{fields[5][lang]}</dt><dd>{row.description || '—'}</dd></div>
                  <div><dt>{fields[6][lang]}</dt><dd>{row.sell_category || '—'}</dd></div>
                  <div><dt>{fields[7][lang]}</dt><dd>{row.status_category || '—'}</dd></div>
                </dl>}
              </article>)}
            </div>
          </aside>
          <div className="main-map-wrap">
            <ParcelMap parcels={parcels} selectedParcel={parcels.find((row) => row.id === selectedParcelId) || null} focusVersion={focusVersion} onSelectParcel={selectParcel} onGeometryComplete={setDraftGeometry} resetDrawingKey={resetDrawingKey} lang={lang} onError={setError} />
            {addMode && <form className="main-add-panel" onSubmit={(event) => void submitAdd(event)}>
              <div className="main-add-panel-heading"><h3>{lang === 'fr' ? 'Ajouter une parcelle' : 'Add New Parcel'}</h3><button type="button" aria-label={lang === 'fr' ? 'Fermer' : 'Close'} onClick={closeAdd} disabled={savingAdd}>×</button></div>
              <p className="main-add-help">{draftGeometry ? (lang === 'fr' ? 'Contour dessiné. Complétez les informations puis validez.' : 'Boundary drawn. Complete the details and save.') : (lang === 'fr' ? 'Utilisez l’outil polygone sur la carte pour dessiner la parcelle.' : 'Use the polygon tool on the map to draw the parcel.')}</p>
              <label>{lang === 'fr' ? 'Nom de la parcelle' : 'Parcel name'}<input required value={addForm.parcel_name} onChange={(event) => setAddForm((current) => ({ ...current, parcel_name: event.target.value }))} /></label>
              <label>{lang === 'fr' ? 'Propriétaire' : 'Owner'}<input required value={addForm.owner} onChange={(event) => setAddForm((current) => ({ ...current, owner: event.target.value }))} /></label>
              <div className="main-add-grid">
                <label>{lang === 'fr' ? 'Prix / m²' : 'Price / m²'}<input required type="number" min="0" step="0.01" value={addForm.price_m2} onChange={(event) => setAddForm((current) => ({ ...current, price_m2: event.target.value }))} /></label>
                <label>{lang === 'fr' ? 'Prix total' : 'Total price'}<input required type="number" min="0" step="0.01" value={addForm.price} onChange={(event) => setAddForm((current) => ({ ...current, price: event.target.value }))} /></label>
              </div>
              <label>{lang === 'fr' ? 'Devise' : 'Currency'}<select required value={addForm.currency} onChange={(event) => setAddForm((current) => ({ ...current, currency: event.target.value }))}>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label>
              <label>{lang === 'fr' ? 'Localisation' : 'Location'}<input required value={addForm.location_name} onChange={(event) => setAddForm((current) => ({ ...current, location_name: event.target.value }))} /></label>
              <label>{lang === 'fr' ? 'Description' : 'Description'}<textarea required rows="2" value={addForm.description} onChange={(event) => setAddForm((current) => ({ ...current, description: event.target.value }))} /></label>
              <div className="main-add-grid">
                <label>{lang === 'fr' ? 'Statut de vente' : 'Sale status'}<select required value={addForm.sell_category} onChange={(event) => setAddForm((current) => ({ ...current, sell_category: event.target.value }))}><option value="to_sell">{lang === 'fr' ? 'À vendre' : 'For sale'}</option><option value="vendu">{lang === 'fr' ? 'Vendue' : 'Sold'}</option><option value="autre">{lang === 'fr' ? 'Autre' : 'Other'}</option><option value="na">#NA</option></select></label>
                <label>{lang === 'fr' ? 'Statut du titre' : 'Title status'}<select required value={addForm.status_category} onChange={(event) => setAddForm((current) => ({ ...current, status_category: event.target.value }))}><option value="">—</option><option value="titre">Titre</option><option value="titre_borne">Titre et borne</option><option value="kt">Karan-tany</option><option value="na">#NA</option></select></label>
              </div>
              {addError && <p className="main-add-error" role="alert">{addError.message || (lang === 'fr' ? 'Échec de l’ajout.' : 'Unable to add parcel.')}</p>}
              <div className="main-add-actions"><button type="button" onClick={closeAdd} disabled={savingAdd}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</button><button type="submit" disabled={savingAdd}>{savingAdd ? (lang === 'fr' ? 'Enregistrement…' : 'Saving…') : (lang === 'fr' ? 'Valider' : 'Save')}</button></div>
            </form>}
          </div>
        </div>
      </div>
      {editingParcelId && editDraft && (() => {
        const row = parcels.find((parcel) => parcel.id === editingParcelId)
        if (!row) return null
        return <div className="main-edit-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEdit() }}>
          <section className="main-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="main-edit-title">
            <button className="main-edit-close" type="button" aria-label={lang === 'fr' ? 'Fermer' : 'Close'} disabled={savingEdit} onClick={closeEdit}>×</button>
            <h2 id="main-edit-title">{lang === 'fr' ? 'Modifier la parcelle' : 'Edit Parcel'}</h2>
            <div className="main-edit-table-wrap"><table className="main-edit-table"><thead><tr>{fields.map((field) => <th key={field.key} scope="col">{field[lang]}</th>)}</tr></thead><tbody><tr>{fields.map((field) => <td key={field.key}><ParcelCell row={row} field={field} lang={lang} value={editDraft[field.key]} disabled={savingEdit} onChange={(value) => setEditDraft((current) => ({ ...current, [field.key]: value }))} /></td>)}</tr></tbody></table></div>
            {editError && <p className="main-edit-error" role="alert">{editError.message || (lang === 'fr' ? 'Échec de l’enregistrement.' : 'Unable to save parcel changes.')}</p>}
            <button className="main-edit-submit" type="button" disabled={savingEdit} onClick={() => void submitEdit()}>{savingEdit ? (lang === 'fr' ? 'Enregistrement…' : 'Saving…') : (lang === 'fr' ? 'Valider' : 'Save')}</button>
          </section>
        </div>
      })()}
    </section>
  )
}

export default function Main() {
  const { logout, request, downloadKml, status, error } = useAuth()
  const [tab, setTab] = useState(readTab)
  const [lang, setLang] = useState(readLanguage)

  useEffect(() => {
    const sync = () => setTab(readTab())
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync) }
  }, [])

  useEffect(() => {
    document.title = `${tab === 'dashboard' ? 'Dashboard' : pages[tab]?.[lang]?.[0] || 'Tany'} | Tany`
    document.documentElement.lang = lang
    try { localStorage.setItem('language', lang) } catch { /* Language remains available for this visit. */ }
  }, [tab, lang])

  useEffect(() => {
    function answerLegacyRequest(event) {
      const message = event.data
      const source = event.source
      if (event.origin !== window.location.origin || message?.type !== 'tany:legacy-api' ||
          typeof message.path !== 'string' || !message.path.startsWith('/') || !source) return
      const respond = (payload) => {
        const activeFrame = document.querySelector('.main-legacy-frame iframe')
        if (!activeFrame?.isConnected || activeFrame.contentWindow !== source) return
        try { source.postMessage(payload, event.origin) } catch { /* The iframe may have navigated during the request. */ }
      }
      const body = message.body?.kind === 'form'
        ? (() => { const form = new FormData(); for (const [key, value] of message.body.entries) form.append(key, value); return form })()
        : message.body?.value
      const action = message.path === '/export/kml'
        ? downloadKml().then(async (file) => ({ binary: true, body: await file.arrayBuffer() }))
        : request(message.path, { method: message.method, ...(body == null ? {} : { body }) }).then((data) => ({ data }))
      action
        .then(
          (result) => respond({ type: 'tany:legacy-api-result', id: message.id, status: 200, ...result }),
          (failure) => respond({ type: 'tany:legacy-api-result', id: message.id, status: failure.status || 503, data: { success: false, message: failure.message } }),
        )
    }
    window.addEventListener('message', answerLegacyRequest)
    return () => window.removeEventListener('message', answerLegacyRequest)
  }, [request, downloadKml])

  function switchTab(event, next) {
    event.preventDefault()
    window.history.pushState(null, '', next === 'dashboard' ? '/main' : `/main#${next}`)
    setTab(next)
  }

  async function signOut() {
    await logout()
    window.location.replace('/signin')
  }

  const nav = () => tabs.map((item) => <a key={item.id} href={item.id === 'dashboard' ? '/main' : `/main#${item.id}`} aria-current={tab === item.id ? 'page' : undefined} className={tab === item.id ? 'is-active' : ''} onClick={(event) => switchTab(event, item.id)}><span className="main-nav-icon" aria-hidden="true">{item.icon}</span><span>{item[lang]}</span></a>)
  const page = pages[tab]

  return <div className={`main-page${tab === 'crops' ? ' main-page-marketplace' : ''}`}>
    <header className="main-header"><div className="main-header-inner">
      <a className="main-brand" href="/" aria-label="Tany Landtrust, home"><span className="main-brand-name">tany Landtrust</span></a>
      <nav className="main-desktop-nav" aria-label={lang === 'fr' ? 'Navigation principale' : 'Main navigation'}>{nav()}</nav>
      <div className="main-header-actions">
        <button className="main-logout" type="button" onClick={() => void signOut()} disabled={status === 'signingOut'}>{status === 'signingOut' ? '…' : lang === 'fr' ? 'Déconnexion' : 'Log Out'}</button>
        <details className="main-language-menu">
          <summary aria-label={lang === 'fr' ? 'Changer de langue, français sélectionné' : 'Change language, French selected'}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>
            <span>FR</span><i aria-hidden="true" />
          </summary>
          <div className="main-language-options" role="group" aria-label="Switch language">
            {['en', 'fr'].map((language) => <button key={language} type="button" lang={language} aria-pressed={lang === language} onClick={(event) => { setLang(language); event.currentTarget.closest('details')?.removeAttribute('open') }}>{language.toUpperCase()}</button>)}
          </div>
        </details>
      </div>
    </div></header>
    <main className={`main-content${tab === 'crops' ? ' main-content-marketplace' : ''}`}>{tab === 'dashboard' ? <Dashboard lang={lang} /> : tab === 'crops' ? <Marketplace lang={lang} /> : <section className="main-section" aria-labelledby="main-legacy-title"><h1 id="main-legacy-title">{page[lang][0]}</h1>{page[lang][1] && <p className="main-subtitle">{page[lang][1]}</p>}<div className="main-legacy-frame"><iframe title={page[lang][0]} src={legacyUrl(page.file)} loading="lazy" /></div></section>}{error && <p className="main-feedback main-error" role="status">{error.message}</p>}</main>
    <nav className="main-mobile-nav" aria-label={lang === 'fr' ? 'Navigation mobile' : 'Mobile navigation'}>{nav()}</nav>
  </div>
}
