import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile, rename, rm, copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { catalog } from './catalog.mjs';

export const FULFILLMENT_STATES = ['test_order_held', 'ready_for_purchase', 'claimed', 'purchase_prepared', 'supplier_confirmed', 'tracking_recorded', 'problem'];
const transitions = new Map([
  ['test_order_held', new Set(['ready_for_purchase', 'problem'])],
  ['ready_for_purchase', new Set(['claimed', 'problem'])],
  ['claimed', new Set(['purchase_prepared', 'problem'])],
  ['purchase_prepared', new Set(['supplier_confirmed', 'problem'])],
  ['supplier_confirmed', new Set(['tracking_recorded', 'problem'])],
  ['tracking_recorded', new Set()], ['problem', new Set(['ready_for_purchase'])]
]);
const locks = new Map();
const nextTurn = id => { const prior = locks.get(id) || Promise.resolve(); let release; const current = new Promise(resolve => { release = resolve; }); locks.set(id, prior.then(() => current)); return prior.then(() => release); };

function originFor(catalogId) { return catalog.get(Number(catalogId))?.origin || null; }
function enrich(order) { return { ...order, items: (order.items || []).map(item => ({ ...item, originLink: item.originLink || originFor(item.catalogId) })) }; }
export function assertTransition(from, to) { if (from !== to && !transitions.get(from)?.has(to)) { const error = new Error(`Invalid transition: ${from} -> ${to}`); error.code = 'INVALID_TRANSITION'; throw error; } }
export function validateAgentId(value) { if (typeof value !== 'string' || !/^[A-Za-z0-9._-]{1,80}$/.test(value)) { const error = new Error('Invalid agentId.'); error.code = 'INVALID_INPUT'; throw error; } return value; }
export function validateText(value, name) { if (typeof value !== 'string' || value.length < 1 || value.length > 200) { const error = new Error(`${name} is required and must be 1-200 characters.`); error.code = 'INVALID_INPUT'; throw error; } return value; }
export function notificationLog(directory) { const file = join(directory, 'notifications.jsonl'); return { async add(entry) { await writeFile(file, `${JSON.stringify({ ...entry, at: new Date().toISOString() })}\n`, { flag: 'a', mode: 0o600 }); }, file }; }
export async function updateOrder(directory, id, mutate) {
  const release = await nextTurn(id);
  try {
    const file = join(directory, `${id}.json`);
    const current = JSON.parse(await readFile(file, 'utf8'));
    const next = enrich(await mutate(current));
    const temporary = `${file}.${randomBytes(8).toString('hex')}.tmp`;
    await writeFile(temporary, JSON.stringify(next), { mode: 0o600, flag: 'wx' });
    await replaceFile(temporary, file);
    return next;
  }
  finally { release(); locks.delete(id); }
}
async function replaceFile(temporary, file) {
  try { await rename(temporary, file); return; }
  catch (error) {
    if (error.code !== 'EPERM' && error.code !== 'EACCES') {
      await rm(temporary, { force: true });
      throw error;
    }
  }
  const backup = join(dirname(file), `${file.split(/[\\/]/).pop()}.${randomBytes(8).toString('hex')}.bak`);
  try {
    await rename(file, backup);
    try { await rename(temporary, file); }
    catch (error) {
      await copyFile(temporary, file);
      await rm(temporary, { force: true });
    }
    await rm(backup, { force: true });
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}
export function supplierPurchasePlan(order) { if (order.mode !== 'test' || order.purchasingEnabled !== false) throw new Error('Real supplier purchasing is disabled until live controls are configured.'); return { mode: 'dry_run', orderId: order.id, supplierPaymentSource: 'blocked_no_customer_card', items: order.items.map(item => ({ catalogId: item.catalogId, name: item.name, quantity: item.quantity, originLink: item.originLink })) }; }
export function claimToken() { return randomBytes(32).toString('base64url'); }
export function hashToken(token) { return createHash('sha256').update(String(token)).digest('hex'); }
export function tokenMatches(token, hash) { return Boolean(token && hash && hashToken(token) === hash); }
export function requireClaim(order, agentId, token) { validateAgentId(agentId); if (order.claimedBy !== agentId || !tokenMatches(token, order.claimTokenHash)) { const error = new Error('Claim owner or token is invalid.'); error.code = 'UNAUTHORIZED_CLAIM'; throw error; } }
export function transitionOrder(order, status) { assertTransition(order.status, status); return { ...order, status }; }
