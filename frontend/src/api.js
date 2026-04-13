const BASE = '/api'

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData
  const res = await fetch(`${BASE}${path}`, {
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
  // Deals
  getDeals:     ()         => request('/deals'),
  createDeal:   (data)     => request('/deals',         { method: 'POST',   body: JSON.stringify(data) }),
  updateDeal:   (id, data) => request(`/deals/${id}`,   { method: 'PUT',    body: JSON.stringify(data) }),
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
    const res = await fetch(`/api/deals/${dealId}/documents?category=${encodeURIComponent(category)}`, { method: 'POST', body: fd })
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
  updateContact:       (contactId, data)     => request(`/contacts/${contactId}`,              { method: 'PUT',    body: JSON.stringify(data) }),
  deleteContact:       (contactId)           => request(`/contacts/${contactId}`,              { method: 'DELETE' }),
  createInteraction:   (contactId, data)     => request(`/contacts/${contactId}/interactions`, { method: 'POST',   body: JSON.stringify(data) }),
  updateInteraction:   (interactionId, data) => request(`/interactions/${interactionId}`,      { method: 'PUT',    body: JSON.stringify(data) }),
  deleteInteraction:   (interactionId)       => request(`/interactions/${interactionId}`,      { method: 'DELETE' }),

  // File upload
  uploadFile: async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`${BASE}/upload`, { method: 'POST', body: fd })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
      throw new Error(err.detail || 'Upload failed')
    }
    return res.json()  // { filename, original_name }
  },

  uploadUrl: (filename) => `${BASE}/uploads/${filename}`,
}
