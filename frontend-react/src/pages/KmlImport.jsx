import { useRef, useState } from 'react'
import { isValidParcelBoundary } from './parcelMapData.js'
import {
  KML_CURRENCIES,
  KML_CURRENCY_LABELS,
  MAX_KML_FILE_SIZE,
  uploadKmlParcel,
  validateKmlFields,
  validateKmlFile,
} from './kmlImportData.js'

const emptyFields = () => ({
  owner: '', parcel_name: '', price_m2: '', price: '', currency: '',
  location_name: '', description: '', sell_category: '', status_category: '',
})

const copy = {
  en: {
    title: 'Import KML parcel', close: 'Close KML import', step: 'Step', drawTitle: 'Step 1 — Draw parcel boundary',
    drawHelp: 'Use the polygon tool at the top-right of the map to draw and finish the parcel outline.',
    drawMissing: 'A valid parcel boundary is required before you can continue.', drawReady: 'Parcel boundary captured. You can continue to parcel information.',
    next: 'Continue', back: 'Back', detailsTitle: 'Step 2 — Parcel information',
    parcelName: 'Parcel Name', owner: 'Parcel Owner', priceM2: 'Price per m²', currency: 'Currency',
    chooseCurrency: 'Select a currency', category: 'Category', chooseCategory: 'Select an option',
    status: 'Status of Land', price: 'Price Total', location: 'Location Name', description: 'Description',
    dropTitle: 'Drag and drop your KML file', browse: 'Browse Files', supported: 'KML files only, up to 10 MB.',
    remove: 'Remove selected file', upload: 'Import KML File', uploading: 'Importing…',
    fileRequired: 'Select a KML file to continue.', fileType: 'Please select a KML file (.kml).',
    fileSize: 'The KML file must not exceed 10 MB.', geometry: 'Draw a valid parcel boundary on the map before importing.',
    auth: 'The signed-in account email is unavailable.', invalid: 'Complete the required fields with valid values.',
    kml: 'KML file', cancel: 'Cancel',
  },
  fr: {
    title: 'Importer une parcelle KML', close: 'Fermer l’import KML', step: 'Étape', drawTitle: 'Étape 1 — Délimiter la parcelle',
    drawHelp: 'Utilisez l’outil polygone en haut à droite de la carte, puis terminez le contour.',
    drawMissing: 'Un contour valide est obligatoire avant de continuer.', drawReady: 'Contour de parcelle enregistré. Vous pouvez passer aux informations.',
    next: 'Continuer', back: 'Retour', detailsTitle: 'Étape 2 — Informations de la parcelle',
    parcelName: 'Nom de la parcelle', owner: 'Propriétaire', priceM2: 'Prix au m²', currency: 'Devise',
    chooseCurrency: 'Choisir une devise', category: 'Catégorie', chooseCategory: 'Choisir une option',
    status: 'Statut du terrain', price: 'Prix total', location: 'Localisation', description: 'Description',
    dropTitle: 'Déposez le fichier KML ici', browse: 'Parcourir les fichiers', supported: 'Fichiers KML uniquement, 10 Mo maximum.',
    remove: 'Retirer le fichier sélectionné', upload: 'Importer le fichier KML', uploading: 'Import en cours…',
    fileRequired: 'Sélectionnez un fichier KML pour continuer.', fileType: 'Sélectionnez un fichier KML (.kml).',
    fileSize: 'Le fichier KML ne doit pas dépasser 10 Mo.', geometry: 'Délimitez un contour valide sur la carte avant l’import.',
    auth: 'L’adresse e-mail du compte connecté est indisponible.', invalid: 'Complétez les champs obligatoires avec des valeurs valides.',
    kml: 'Fichier KML', cancel: 'Annuler',
  },
}

function fileErrorMessage(reason, labels) {
  if (reason === 'required') return labels.fileRequired
  if (reason === 'extension') return labels.fileType
  if (reason === 'size') return labels.fileSize
  return labels.invalid
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function KmlImport({ request, userEmail, boundary, onClose, onImported, lang = 'en' }) {
  const labels = copy[lang === 'fr' ? 'fr' : 'en']
  const [step, setStep] = useState(1)
  const [fields, setFields] = useState(emptyFields)
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef(null)
  const hasValidBoundary = isValidParcelBoundary(boundary)

  function selectFile(nextFile) {
    const reason = validateKmlFile(nextFile)
    if (reason) {
      setError(fileErrorMessage(reason, labels))
      return
    }
    setFile(nextFile)
    setError('')
  }

  function continueToDetails() {
    if (!hasValidBoundary) {
      setError(labels.geometry)
      return
    }
    setError('')
    setStep(2)
  }

  async function submit(event) {
    event.preventDefault()
    if (saving) return
    if (!hasValidBoundary) { setError(labels.geometry); setStep(1); return }
    const fileReason = validateKmlFile(file)
    if (fileReason) { setError(fileErrorMessage(fileReason, labels)); return }
    if (validateKmlFields(fields)) { setError(labels.invalid); return }
    if (!userEmail) { setError(labels.auth); return }

    setSaving(true)
    setError('')
    try {
      await uploadKmlParcel(request, { file, fields, ownerEmail: userEmail, boundary })
      onImported()
    } catch (failure) {
      setError(failure?.message || labels.invalid)
    } finally {
      setSaving(false)
    }
  }

  return <section className={`main-add-panel main-kml-panel${step === 1 ? ' is-drawing-step' : ''}`} aria-label={labels.title}>
    <div className="main-add-panel-heading">
      <div><h3>{labels.title}</h3><span className="main-kml-step-count">{labels.step} {step} / 2</span></div>
      <button type="button" aria-label={labels.close} onClick={onClose} disabled={saving}>×</button>
    </div>

    {step === 1 ? <div className="main-kml-draw-step">
      <h4>{labels.drawTitle}</h4>
      <p className="main-add-help">{labels.drawHelp}</p>
      <p className={`main-kml-boundary-state${hasValidBoundary ? ' is-valid' : ''}`} role="status">
        {hasValidBoundary ? labels.drawReady : labels.drawMissing}
      </p>
      <div className="main-add-actions">
        <button type="button" onClick={onClose}>{labels.cancel}</button>
        <button type="button" disabled={!hasValidBoundary} onClick={continueToDetails}>{labels.next}</button>
      </div>
    </div> : <form className="main-kml-form" onSubmit={(event) => void submit(event)}>
      <h4>{labels.detailsTitle}</h4>
      <label>{labels.parcelName}<input required value={fields.parcel_name} onChange={(event) => setFields((current) => ({ ...current, parcel_name: event.target.value }))} /></label>
      <label>{labels.owner}<input value={fields.owner} onChange={(event) => setFields((current) => ({ ...current, owner: event.target.value }))} /></label>
      <div className="main-add-grid">
        <label>{labels.priceM2}<input type="number" step="any" value={fields.price_m2} onChange={(event) => setFields((current) => ({ ...current, price_m2: event.target.value }))} /></label>
        <label>{labels.price}<input required type="number" step="any" value={fields.price} onChange={(event) => setFields((current) => ({ ...current, price: event.target.value }))} /></label>
      </div>
      <label>{labels.currency}<select required value={fields.currency} onChange={(event) => setFields((current) => ({ ...current, currency: event.target.value }))}>
        <option value="">{labels.chooseCurrency}</option>{KML_CURRENCIES.map((currency) => <option key={currency} value={currency}>{KML_CURRENCY_LABELS[currency]}</option>)}
      </select></label>
      <div className="main-add-grid">
        <label>{labels.category}<select required value={fields.sell_category} onChange={(event) => setFields((current) => ({ ...current, sell_category: event.target.value }))}>
          <option value="">{labels.chooseCategory}</option><option value="to_sell">A vendre</option><option value="vendu">Vendue</option><option value="autre">Autre</option><option value="na">#NA</option>
        </select></label>
        <label>{labels.status}<select required value={fields.status_category} onChange={(event) => setFields((current) => ({ ...current, status_category: event.target.value }))}>
          <option value="">{labels.chooseCategory}</option><option value="titre">Titre</option><option value="titre_borne">Titre et borne</option><option value="kt">Karan-tany</option><option value="na">#NA</option>
        </select></label>
      </div>
      <label>{labels.location}<input value={fields.location_name} onChange={(event) => setFields((current) => ({ ...current, location_name: event.target.value }))} /></label>
      <label>{labels.description}<textarea rows="3" value={fields.description} onChange={(event) => setFields((current) => ({ ...current, description: event.target.value }))} /></label>

      <div
        className={`main-kml-dropzone${dragging ? ' is-dragging' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files?.[0]) }}
      >
        <strong>{labels.dropTitle}</strong>
        <span>{labels.supported}</span>
        <input ref={fileInput} type="file" accept=".kml,application/vnd.google-earth.kml+xml" aria-label={labels.kml} onChange={(event) => selectFile(event.target.files?.[0])} />
        <button type="button" onClick={() => fileInput.current?.click()} disabled={saving}>{labels.browse}</button>
      </div>
      {file && <div className="main-kml-file-info"><span><strong>{file.name}</strong><small>{formatFileSize(file.size)} · ≤ {MAX_KML_FILE_SIZE / (1024 * 1024)} MB</small></span><button type="button" aria-label={labels.remove} disabled={saving} onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = '' }}>×</button></div>}
      {error && <p className="main-add-error" role="alert">{error}</p>}
      {saving && <div className="main-kml-progress" role="status"><span />{labels.uploading}</div>}
      <div className="main-add-actions">
        <button type="button" disabled={saving} onClick={() => setStep(1)}>{labels.back}</button>
        <button type="submit" disabled={saving || !hasValidBoundary}>{saving ? labels.uploading : labels.upload}</button>
      </div>
    </form>}
    {step === 1 && error && <p className="main-add-error" role="alert">{error}</p>}
  </section>
}
