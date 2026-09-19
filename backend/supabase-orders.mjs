import { HttpError } from './checkout.mjs';

export function supabaseOrderStore(projectUrl, secret, fetchImpl = fetch) {
  const url = new URL(projectUrl);
  if (url.protocol !== 'https:' || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname) ||
      url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SUPABASE_URL must be your HTTPS Supabase project origin.');
  }
  if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(secret || '')) {
    throw new Error('SUPABASE_SECRET_KEY must be a backend secret key beginning sb_secret_.');
  }
  async function request(query, body) {
    let response;
    try {
      response = await fetchImpl(`${url.origin}/rest/v1/otaku_orders?${query}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          apikey: secret,
          ...(body ? { 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Storage request failed');
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Invalid storage response');
      return rows;
    } catch {
      // Do not expose upstream responses containing credentials or customer data.
      throw new HttpError(503, 'Order storage is unavailable. Please retry.');
    }
  }
  return {
    async check() { await request('select=id&limit=1'); },
    async save(order) {
      if (!/^cs_test_[A-Za-z0-9]{1,200}$/.test(order.id || '') || order.mode !== 'test') {
        throw new Error('Only test orders can be saved.');
      }
      const rows = await request('on_conflict=id&select=id', {
        id: order.id, received_at: order.receivedAt, payload: order,
      });
      return rows.length === 1;
    },
    async list() {
      const rows = await request('select=payload&order=received_at.desc,id.desc&limit=100');
      return rows.map(row => row.payload);
    },
  };
}
