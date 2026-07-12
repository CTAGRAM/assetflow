// AssetFlow — single API surface for the whole frontend.
//
// Every screen must read and write through this module. Today the backend is
// still being built in parallel, so most calls temporarily resolve the design
// prototype's sample data (from src/data.js) instead of hitting the server.
// Each of those is wrapped in `demo(...)` which logs a loud, greppable
// `[TODO][api]` warning at runtime. When the matching endpoint lands, swap the
// `demo(...)` line for the `request(...)` line already written beside it — a
// one-line change per call. The health check below already talks to the real
// server, proving the wiring works end to end.
//
// >>> SUBMISSION GATE: `grep "\[TODO\]\[api\]" src/api.js` MUST return nothing
// >>> before final submission. The app must not ship on static data.

import * as demoData from './data.js';

export const BASE = 'http://localhost:3000/api';

// --- core fetch wrapper ---------------------------------------------------
// Returns parsed JSON on 2xx. On failure throws an Error whose `.message` is
// the server's friendly message when present, never a bare status code, so
// callers can surface it in the UI gracefully instead of a blank failure.
export async function request(path, { method = 'GET', body, headers, ...rest } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body != null ? JSON.stringify(body) : undefined,
      ...rest,
    });
  } catch (networkErr) {
    // fetch only rejects on network-level failure (server down, CORS, DNS).
    throw new Error('Cannot reach the AssetFlow server. Is it running on ' + BASE + '?');
  }

  let payload = null;
  const text = await res.text();
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }

  if (!res.ok) {
    const msg = (payload && (payload.error || payload.message)) || res.statusText || ('Request failed (' + res.status + ')');
    const err = new Error(msg);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

// --- demo-data fallback ---------------------------------------------------
// Resolves prototype sample data through a promise so callers use the exact
// same `await api.x()` shape they will use against the real endpoint. Warns
// once per key so the console makes clear which screens are still on stubs.
const warned = new Set();
function demo(key, value) {
  if (!warned.has(key)) {
    warned.add(key);
    // eslint-disable-next-line no-console
    console.warn('[TODO][api] "' + key + '" is served from static demo data (src/data.js). Replace with a real endpoint before submission.');
  }
  return Promise.resolve(value);
}

// --- health (REAL endpoint, already live) ---------------------------------
export function health() {
  return request('/health');
}

// --- auth -----------------------------------------------------------------
// Signup always creates an `employee`; there is deliberately no role field.
export function login(credentials) {
  // TODO: return request('/auth/login', { method: 'POST', body: credentials });
  return demo('auth.login', { ok: true, user: demoData.me(), token: 'demo-token' });
}
export function signup(details) {
  // TODO: return request('/auth/signup', { method: 'POST', body: details });
  return demo('auth.signup', { ok: true, user: { ...details, role: 'Employee' }, token: 'demo-token' });
}

// --- assets ---------------------------------------------------------------
export function getAssets() {
  // TODO: return request('/assets');
  return demo('assets.list', demoData.assets);
}
export function getAsset(tag) {
  // TODO: return request('/assets/' + encodeURIComponent(tag));
  return demo('assets.get', demoData.assets.find((a) => a.tag === tag) || null);
}
export function createAsset(asset) {
  // TODO: return request('/assets', { method: 'POST', body: asset });
  return demo('assets.create', { ok: true, asset });
}
export function getCategories() {
  // TODO: return request('/categories');
  return demo('categories.list', demoData.categories);
}

// --- allocation & transfer ------------------------------------------------
export function getAllocations() {
  // TODO: return request('/allocations');
  return demo('allocations.list', demoData.allocations);
}
export function getTransfers() {
  // TODO: return request('/transfers');
  return demo('transfers.list', demoData.transfers);
}
export function allocateAsset(payload) {
  // TODO: return request('/allocations', { method: 'POST', body: payload });
  return demo('allocations.create', { ok: true, ...payload });
}
export function returnAsset(payload) {
  // TODO: return request('/allocations/' + encodeURIComponent(payload.id) + '/return', { method: 'POST', body: payload });
  return demo('allocations.return', { ok: true, ...payload });
}
export function requestTransfer(payload) {
  // TODO: return request('/transfers', { method: 'POST', body: payload });
  return demo('transfers.create', { ok: true, ...payload });
}

// --- bookings -------------------------------------------------------------
export function getBookings() {
  // TODO: return request('/bookings');
  return demo('bookings.list', demoData.bookings);
}
export function createBooking(payload) {
  // TODO: return request('/bookings', { method: 'POST', body: payload });
  return demo('bookings.create', { ok: true, ...payload });
}
export function cancelBooking(id) {
  // TODO: return request('/bookings/' + encodeURIComponent(id) + '/cancel', { method: 'POST' });
  return demo('bookings.cancel', { ok: true, id });
}
export function rescheduleBooking(id, payload) {
  // TODO: return request('/bookings/' + encodeURIComponent(id) + '/reschedule', { method: 'POST', body: payload });
  return demo('bookings.reschedule', { ok: true, id, ...payload });
}

// --- org / people (owned by Tanishq's screens, exposed here for shared use) --
export function getEmployees() {
  // TODO: return request('/employees');
  return demo('employees.list', demoData.employees);
}
export function getDepartments() {
  // TODO: return request('/departments');
  return demo('departments.list', demoData.departments);
}
export function getNotifications() {
  // TODO: return request('/notifications');
  return demo('notifications.list', demoData.notifications);
}
export function markNotificationRead(id) {
  // TODO: return request('/notifications/' + encodeURIComponent(id) + '/read', { method: 'POST' });
  return demo('notifications.read', { ok: true, id });
}
export function markAllNotificationsRead() {
  // TODO: return request('/notifications/read-all', { method: 'POST' });
  return demo('notifications.readAll', { ok: true });
}
export function getActivity(params) {
  // TODO: return request('/activity' + qs(params));
  return demo('activity.list', demoData.activity);
}

// --- organization writes (Tanishq's Organization screen) ------------------
// The Employee Directory PATCH is the ONLY place an Employee gets promoted.
export function createDepartment(payload) {
  // TODO: return request('/departments', { method: 'POST', body: payload });
  return demo('departments.create', { ok: true, ...payload });
}
export function updateDepartment(id, patch) {
  // TODO: return request('/departments/' + encodeURIComponent(id), { method: 'PATCH', body: patch });
  return demo('departments.update', { ok: true, id, ...patch });
}
export function createCategory(payload) {
  // TODO: return request('/categories', { method: 'POST', body: payload });
  return demo('categories.create', { ok: true, ...payload });
}
export function updateCategory(id, patch) {
  // TODO: return request('/categories/' + encodeURIComponent(id), { method: 'PATCH', body: patch });
  return demo('categories.update', { ok: true, id, ...patch });
}
export function updateEmployee(id, patch) {
  // TODO: return request('/employees/' + encodeURIComponent(id), { method: 'PATCH', body: patch });
  return demo('employees.update', { ok: true, id, ...patch });
}

// --- maintenance (Tanishq's Maintenance screen) ---------------------------
export function getMaintenance(params) {
  // TODO: return request('/maintenance' + qs(params));
  return demo('maintenance.list', demoData.maintenance);
}
export function createMaintenance(payload) {
  // TODO: return request('/maintenance', { method: 'POST', body: payload });
  return demo('maintenance.create', { ok: true, ...payload });
}
export function decideMaintenance(id, payload) {
  // TODO: return request('/maintenance/' + encodeURIComponent(id) + '/decide', { method: 'POST', body: payload });
  return demo('maintenance.decide', { ok: true, id, ...payload });
}
export function assignMaintenance(id, payload) {
  // TODO: return request('/maintenance/' + encodeURIComponent(id) + '/assign', { method: 'POST', body: payload });
  return demo('maintenance.assign', { ok: true, id, ...payload });
}
export function startMaintenance(id) {
  // TODO: return request('/maintenance/' + encodeURIComponent(id) + '/start', { method: 'POST' });
  return demo('maintenance.start', { ok: true, id });
}
export function resolveMaintenance(id) {
  // TODO: return request('/maintenance/' + encodeURIComponent(id) + '/resolve', { method: 'POST' });
  return demo('maintenance.resolve', { ok: true, id });
}

// --- audits (Tanishq's Audits screen) -------------------------------------
export function getAudits() {
  // TODO: return request('/audits');
  return demo('audits.list', demoData.audits);
}
export function getAudit(id) {
  // TODO: return request('/audits/' + encodeURIComponent(id));
  return demo('audits.get', demoData.audits.find((a) => a.id === id) || null);
}
export function createAudit(payload) {
  // TODO: return request('/audits', { method: 'POST', body: payload });
  return demo('audits.create', { ok: true, ...payload });
}
export function saveAuditRecord(id, payload) {
  // TODO: return request('/audits/' + encodeURIComponent(id) + '/records', { method: 'POST', body: payload });
  return demo('audits.record', { ok: true, id, ...payload });
}
export function getAuditDiscrepancies(id) {
  // TODO: return request('/audits/' + encodeURIComponent(id) + '/discrepancies');
  const cyc = demoData.audits.find((a) => a.id === id) || { items: [] };
  return demo('audits.discrepancies', cyc.items.filter((i) => i.result === 'Missing' || i.result === 'Damaged'));
}
export function closeAudit(id) {
  // TODO: return request('/audits/' + encodeURIComponent(id) + '/close', { method: 'POST' });
  return demo('audits.close', { ok: true, id });
}

// --- reports (Tanishq's Reports screen) -----------------------------------
// The report cards recreate the prototype's exact visuals by computing over the
// collections above (assets / bookings / maintenance / departments), so the
// only report-specific endpoints are the optional pre-aggregated ones below.
// When the backend lands, screens may switch to these or keep computing client
// side — either way the reads still flow through this module.
export function getReportSummary() {
  // TODO: return request('/reports/summary');
  return demo('reports.summary', {});
}

// small querystring helper for the GET endpoints above
function qs(params) {
  if (!params) return '';
  const p = Object.entries(params).filter(([, v]) => v != null && v !== '');
  return p.length ? '?' + p.map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&') : '';
}

const api = {
  BASE, request, health,
  login, signup,
  getAssets, getAsset, createAsset, getCategories,
  getAllocations, getTransfers, allocateAsset, returnAsset, requestTransfer,
  getBookings, createBooking, cancelBooking, rescheduleBooking,
  getEmployees, getDepartments, getNotifications,
  markNotificationRead, markAllNotificationsRead, getActivity,
  createDepartment, updateDepartment, createCategory, updateCategory, updateEmployee,
  getMaintenance, createMaintenance, decideMaintenance, assignMaintenance, startMaintenance, resolveMaintenance,
  getAudits, getAudit, createAudit, saveAuditRecord, getAuditDiscrepancies, closeAudit,
  getReportSummary,
};
export default api;
