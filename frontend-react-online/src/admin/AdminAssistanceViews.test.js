import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

let vite
let AdminAssistanceListPage
let AdminAssistanceDetailPage

before(async () => {
  vite = await createServer({
    configFile: './vite.config.js',
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  ;({ AdminAssistanceListPage, AdminAssistanceDetailPage } = await vite.ssrLoadModule('/src/admin/AdminAssistanceViews.jsx'))
})

after(async () => { await vite?.close() })

test('Assistance list and detail states use the selected French copy', () => {
  const list = renderToStaticMarkup(React.createElement(AdminAssistanceListPage, {
    request() {}, lang: 'fr',
  }))
  const detail = renderToStaticMarkup(React.createElement(AdminAssistanceDetailPage, {
    request() {}, id: '73', currentAdminProfileId: '4', lang: 'fr',
  }))

  assert.match(list, /<h1[^>]*>Assistance<\/h1>/)
  assert.match(list, /<label[^>]*>État<\/label>/)
  assert.match(list, /À traiter/)
  assert.match(list, /Chargement des demandes/)
  assert.match(detail, /Retour à l’assistance/)
  assert.match(detail, /Demande d’assistance/)
  assert.match(detail, /Chargement des demandes/)
  assert.doesNotMatch(list + detail, /Open requests|All states|Loading requests|Back to assistance|Assistance request/)
})
