const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
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
  getDeals: () => request('/deals'),
  createDeal: (data) => request('/deals', { method: 'POST', body: JSON.stringify(data) }),
  updateDeal: (id, data) => request(`/deals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDeal: (id) => request(`/deals/${id}`, { method: 'DELETE' }),
  reorderDeals: (items) => request('/deals/reorder', { method: 'POST', body: JSON.stringify(items) }),
}
