export function createAgentClient({ baseUrl, token, fetchImpl = fetch }) {
  async function request(path, body) {
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}${path}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || `HTTP ${response.status}`), { status: response.status, data });
    return data;
  }
  return {
    list: () => fetchImpl(`${baseUrl.replace(/\/$/, '')}/api/orders`, { headers: { authorization: `Bearer ${token}` } }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data.orders; }),
    claim: (id, agentId) => request(`/api/orders/${encodeURIComponent(id)}/claim`, { agentId }),
    purchasePlan: (id, agentId, claimToken) => request(`/api/orders/${encodeURIComponent(id)}/purchase-plan`, { agentId, claimToken }),
    confirmSupplier: (id, agentId, claimToken, confirmationId) => request(`/api/orders/${encodeURIComponent(id)}/supplier-confirmation`, { agentId, claimToken, confirmationId }),
    recordTracking: (id, agentId, claimToken, carrier, trackingNumber) => request(`/api/orders/${encodeURIComponent(id)}/tracking`, { agentId, claimToken, carrier, trackingNumber })
  };
}
