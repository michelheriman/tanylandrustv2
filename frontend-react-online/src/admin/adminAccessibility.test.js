import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { ADMIN_UNAVAILABLE_MESSAGE } from './adminViewModel.js'

const appSource = await readFile(new URL('./AdminApp.jsx', import.meta.url), 'utf8')
const dashboardSource = await readFile(new URL('./AdminDashboard.jsx', import.meta.url), 'utf8')
const apiSource = await readFile(new URL('./adminApi.js', import.meta.url), 'utf8')
const conversationSource = await readFile(new URL('./AdminConversationViews.jsx', import.meta.url), 'utf8')

test('admin views keep server authorization, empty states, accessible navigation, and inert future actions', () => {
  assert.match(appSource, /loadAdminIdentity\(adminRequest\)/)
  assert.match(appSource, /createAdminReadRequest\(request,/)
  assert.match(appSource, /previous\.adminRequest\.clearInflight\(\)/)
  assert.match(appSource, /onClick=\{handleAdminNavigation\}/)
  assert.match(appSource, /<nav aria-label=\{lang === 'fr' \? 'Navigation administrateur' : 'Administrator navigation'\}/)
  assert.match(appSource, /aria-current=\{active \? 'page' : undefined\}/)
  assert.equal(ADMIN_UNAVAILABLE_MESSAGE, 'Data unavailable for the moment.')
  assert.match(appSource, /model\.unavailableMessage/)
  assert.match(appSource, /<button key=\{action\} type="button" disabled>/)
  assert.match(dashboardSource, /admin-metric-open/)
  assert.doesNotMatch(dashboardSource, /Monthly revenue|Avg\. daily active users|Daily active users/)
  assert.match(appSource, /AdminParcelDetailPage request=\{request\} id=\{route\.id\}/)
  assert.doesNotMatch(appSource, /admin-media-placeholder|admin-image-glyph/)
  assert.match(conversationSource, /admin-report-slot/)
  assert.match(conversationSource, /createAdminConversationReport\(request, id, note\)/)
  assert.match(conversationSource, /<button\s+className="admin-danger-button"\s+type="submit"/)
  assert.match(conversationSource, /maxLength=\{2000\}/)
  assert.match(conversationSource, /Internal note for administrators only/)
  assert.match(appSource, /AdminConversationListPage request=\{request\}/)
  assert.match(appSource, /AdminConversationDetailPage key=\{route\.id\} request=\{request\} id=\{route\.id\}/)
  assert.match(conversationSource, /unlinkedHistoryExcluded/)
  assert.match(apiSource, /data\.admin\.role !== 'admin'/)
  assert.doesNotMatch(apiSource, /profile\.account|profile\.email/)
  for (const path of ['/parcels', '/users', '/messages', '/market', '/load_object', '/load_message']) {
    assert.equal(appSource.includes(`request('${path}`), false)
  }
})
