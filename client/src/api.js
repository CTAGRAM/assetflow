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

const api = {
  BASE, request, health,
  login, signup,
  getAssets, getAsset, createAsset, getCategories,
  getAllocations, getTransfers, allocateAsset, returnAsset, requestTransfer,
  getBookings, createBooking, cancelBooking, rescheduleBooking,
  getEmployees, getDepartments, getNotifications,
};
export default api;
