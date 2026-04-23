const BASE = '/api'

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: isFormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // Auth
  login:          (username, password) => request('/auth/login',           { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout:         ()                   => request('/auth/logout',          { method: 'POST' }),
  getMe:          ()                   => request('/auth/me'),
  changePassword: (current_password, new_password) => request('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) }),

  // User management (admin only)
  getUsers:    ()            => request('/users'),
  createUser:  (data)        => request('/users',       { method: 'POST',  body: JSON.stringify(data) }),
  updateUser:  (id, data)    => request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUser:  (id)          => request(`/users/${id}`, { method: 'DELETE' }),

  // Deals
  getDeals:     ()         => request('/deals'),
  createDeal:   (data)     => request('/deals',         { method: 'POST',   body: JSON.stringify(data) }),
  updateDeal:   (id, data) => request(`/deals/${id}`,   { method: 'PATCH',  body: JSON.stringify(data) }),
  deleteDeal:   (id)       => request(`/deals/${id}`,   { method: 'DELETE' }),
  reorderDeals: (items)    => request('/deals/reorder', { method: 'POST',   body: JSON.stringify(items) }),

  // Notes
  getNotes:   (dealId)       => request(`/deals/${dealId}/notes`),
  createNote: (dealId, data) => request(`/deals/${dealId}/notes`, { method: 'POST', body: JSON.stringify(data) }),
  updateNote: (noteId, data) => request(`/notes/${noteId}`,       { method: 'PUT',  body: JSON.stringify(data) }),
  deleteNote: (noteId)       => request(`/notes/${noteId}`,       { method: 'DELETE' }),

  // Documents
  getDocuments:   (dealId)           => request(`/deals/${dealId}/documents`),
  uploadDocument: async (dealId, file, category) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/deals/${dealId}/documents?category=${encodeURIComponent(category)}`, {
      method: 'POST',
      body: fd,
      credentials: 'include',
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
      throw new Error(err.detail || 'Upload failed')
    }
    return res.json()
  },
  updateDocument: (docId, data)      => request(`/documents/${docId}`,  { method: 'PATCH',  body: JSON.stringify(data) }),
  deleteDocument: (docId)            => request(`/documents/${docId}`,  { method: 'DELETE' }),

  // Contacts
  getContacts:         (dealId)              => request(`/deals/${dealId}/contacts`),
  createContact:       (dealId, data)        => request(`/deals/${dealId}/contacts`,           { method: 'POST',   body: JSON.stringify(data) }),
  updateContact:       (contactId, data)     => request(`/contacts/${contactId}`,              { method: 'PATCH',  body: JSON.stringify(data) }),
  deleteContact:       (contactId)           => request(`/contacts/${contactId}`,              { method: 'DELETE' }),
  createInteraction:   (contactId, data)     => request(`/contacts/${contactId}/interactions`, { method: 'POST',   body: JSON.stringify(data) }),
  updateInteraction:   (interactionId, data) => request(`/interactions/${interactionId}`,      { method: 'PUT',    body: JSON.stringify(data) }),
  deleteInteraction:   (interactionId)       => request(`/interactions/${interactionId}`,      { method: 'DELETE' }),

  // Correspondence (timeline)
  getCorrespondence:    (dealId)          => request(`/deals/${dealId}/correspondence`),
  createCorrespondence: (dealId, data)    => request(`/deals/${dealId}/correspondence`, { method: 'POST', body: JSON.stringify(data) }),
  deleteCorrespondence: (dealId, entryId) => request(`/deals/${dealId}/correspondence/${entryId}`, { method: 'DELETE' }),

  // Sectors
  getSectors:   ()     => request('/sectors'),
  createSector: (data) => request('/sectors', { method: 'POST', body: JSON.stringify(data) }),

  // Team members
  getTeamMembers:    ()              => request('/team-members'),
  updateTeamMember:  (id, data)      => request(`/team-members/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Alerts
  getOverdueAlerts: () => request('/alerts/overdue'),
  sendAlertEmails:  () => request('/alerts/send-email', { method: 'POST' }),

  // File upload
  uploadFile: async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${BASE}/upload`, { method: 'POST', body: fd, credentials: 'include' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
      throw new Error(err.detail || 'Upload failed')
    }
    return res.json()
  },

  uploadUrl: (filename) => `${BASE}/uploads/${filename}`,

  // Analytics
  getAnalytics: () => request('/analytics/'),

  // Import / seed
  importDeals: async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/deals/import', { method: 'POST', body: fd, credentials: 'include' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Import failed' }))
      throw new Error(err.detail || 'Import failed')
    }
    return res.json()
  },

  seedDeals: () => request('/deals/seed', { method: 'POST' }),
}
