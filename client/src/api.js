// AssetFlow — single API surface for the whole frontend.
//
// This talks to the real backend documented at http://localhost:3000/api.
// Every screen reads and writes through this module. The backend is snake_case
// with integer ids and lowercase enums; the screens (ported from the design
// prototype) speak a camelCase, slug/tag-keyed shape. This module is the
// adapter between the two:
//
//   • reads   — call the live endpoint, then NORMALIZE each row into the shape
//               the screens expect (Title-case status, category slug, tag keys).
//   • writes  — TRANSFORM the screen's payload into the API's body (integer
//               ids resolved by natural key: asset tag, person name, category
//               name), then POST/PATCH.
//   • auth    — login/signup persist the JWT; every other request sends it as
//               a Bearer token.
//   • errors  — the documented shapes (400 {errors}, 409 {error, suggestion},
//               403 {error}) become a thrown Error with .message/.errors/
//               .suggestion so screens show them gracefully, never a blank fail.
//
// If the server is unreachable (or the caller isn't signed in yet) READS fall
// back to the prototype sample data so the UI never blank-screens in local dev.
// That fallback is a safety net, not the source of truth: when the API is up,
// live data is used. Each fallback logs a greppable "[api] live unavailable".

import * as demo from './data.js';

export const BASE = 'http://localhost:3000/api';

// ---------------------------------------------------------------- session ---
const TOKEN_KEY = 'af_token';
export function getToken() { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } }
export function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } }
export function clearToken() { setToken(null); }

// ------------------------------------------------------------ core request ---
// Resolves parsed JSON on 2xx. On failure throws an Error carrying the server's
// friendly message plus `.errors` (field map) / `.suggestion` / `.status`.
export async function request(path, { method = 'GET', body, headers, ...rest } = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...headers,
      },
      body: body != null ? JSON.stringify(body) : undefined,
      ...rest,
    });
  } catch {
    const err = new Error('Cannot reach the AssetFlow server. Is it running on ' + BASE + '?');
    err.offline = true;
    throw err;
  }

  let payload = null;
  const text = await res.text();
  if (text) { try { payload = JSON.parse(text); } catch { payload = text; } }

  if (!res.ok) {
    // expired or revoked session: clear it and hand the user back to login
    if (res.status === 401 && getToken() && !path.startsWith('/auth/')) {
      clearToken();
      try { localStorage.removeItem('af_user'); } catch { /* ignore */ }
      window.location.assign('/login');
    }
    const err = new Error();
    err.status = res.status;
    err.payload = payload;
    if (payload && payload.errors) {
      err.errors = payload.errors;                       // { field: message }
      err.message = Object.values(payload.errors)[0] || 'Please fix the highlighted fields.';
    } else if (payload && payload.error) {
      err.message = payload.error;
      err.suggestion = payload.suggestion;               // e.g. "transfer" on 409
    } else {
      err.message = (typeof payload === 'string' && payload) || res.statusText || ('Request failed (' + res.status + ')');
    }
    throw err;
  }
  return payload;
}

// A read that degrades to sample data if the server is down or we're not signed
// in yet. Real errors (400/403/409) still throw so the UI can surface them.
async function read(path, fallback, mapper) {
  try {
    const rows = await request(path);
    return mapper ? mapper(rows) : rows;
  } catch (e) {
    if (e.offline || e.status === 401) {
      if (!read._warned) read._warned = new Set();
      if (!read._warned.has(path)) { read._warned.add(path); console.warn('[api] live unavailable for ' + path + ' — using sample data.'); }
      return typeof fallback === 'function' ? fallback() : fallback;
    }
    throw e;
  }
}

// -------------------------------------------------------- natural-key maps ---
// Bridges between the demo slug world and the live integer-id world, keyed on
// values that are stable across both (tag, person name, category/dept name).
const demoCatByName = {}; demo.categories.forEach((c) => { demoCatByName[c.name] = c; });
const demoDeptByName = {}; demo.departments.forEach((d) => { demoDeptByName[d.name] = d; });
const demoEmpBySlug = {}; demo.employees.forEach((e) => { demoEmpBySlug[e.id] = e; });

const catSlugByName = (name) => (demoCatByName[name] ? demoCatByName[name].id : name);
const catImgByName = (name) => (demoCatByName[name] ? demoCatByName[name].img : null);
const deptSlugByName = (name) => (demoDeptByName[name] ? demoDeptByName[name].id : name);

// Live-id caches, filled from list reads, used to resolve write payloads.
const cache = { assetIdByTag: {}, empIdByName: {}, catIdByName: {} };
const rememberAssets = (rows) => rows.forEach((a) => { if (a && a.tag != null && a.id != null) cache.assetIdByTag[a.tag] = a.id; });
const rememberEmployees = (rows) => rows.forEach((e) => { if (e && e.name) cache.empIdByName[e.name] = e.id; });
const rememberCategories = (rows) => rows.forEach((c) => { if (c && c.name) cache.catIdByName[c.name] = c.id; });

// Resolve a live user id from either a live int id, a demo slug, or a name.
function resolveUserId(idOrSlugOrName) {
  if (Number.isInteger(idOrSlugOrName)) return idOrSlugOrName;
  const emp = demoEmpBySlug[idOrSlugOrName];
  const name = emp ? emp.name : idOrSlugOrName;
  return cache.empIdByName[name];
}

// Make sure the id caches are warm before a write resolves a natural key.
// Cheap no-op once populated; screens that only read never pay for these.
async function ensureAssets() { if (!Object.keys(cache.assetIdByTag).length) { try { await getAssets(); } catch { /* server down: write will surface its own error */ } } }
async function ensureEmployees() { if (!Object.keys(cache.empIdByName).length) { try { await getEmployees(); } catch { /* as above */ } } }
async function ensureCategories() { if (!Object.keys(cache.catIdByName).length) { try { await getCategories(); } catch { /* as above */ } } }

// ------------------------------------------------------------ normalizers ---
const STATUS_TITLE = { available: 'Available', allocated: 'Allocated', reserved: 'Reserved', under_maintenance: 'Under Maintenance', lost: 'Lost', retired: 'Retired', disposed: 'Disposed' };
const BOOKING_TITLE = { upcoming: 'Upcoming', ongoing: 'Ongoing', completed: 'Completed', cancelled: 'Cancelled' };
const dateOnly = (v) => (v ? String(v).slice(0, 10) : null);
const hhmm = (v) => { const m = String(v).match(/T(\d{2}:\d{2})/); return m ? m[1] : String(v).slice(11, 16); };

function normalizeAsset(r) {
  return {
    id: r.id, tag: r.tag, name: r.name,
    cat: catSlugByName(r.category_name), catName: r.category_name,
    serial: r.serial_number || '—',
    acq: dateOnly(r.acquisition_date),
    cost: r.acquisition_cost != null ? Number(r.acquisition_cost) : 0,
    cond: r.condition || '—', loc: r.location || '—', dept: undefined,
    status: STATUS_TITLE[r.status] || r.status, bookable: !!r.is_bookable,
    img: r.photo_url || catImgByName(r.category_name) || null,
    holder: r.holder_name || null, holderType: 'employee', holderId: r.holder_id || null,
    expReturn: null, extra: r.extra || {},
  };
}

function normalizeAllocation(r) {
  return {
    id: r.id, asset: r.tag, assetName: r.asset_name,
    to: r.holder_name, toId: r.holder_id, toType: 'employee',
    by: r.allocated_by_name, date: dateOnly(r.allocated_at),
    expReturn: dateOnly(r.expected_return_date),
    returned: dateOnly(r.returned_at),
    status: r.returned_at ? 'Returned' : 'Active',
    overdue: !!r.overdue, checkin: r.return_notes || undefined,
  };
}

function normalizeTransfer(r) {
  // Map live request_status (pending/approved/rejected) to the screen's labels.
  const STATUS = { pending: 'Requested', approved: 'Completed', rejected: 'Declined' };
  return {
    id: 'TR-' + r.id, rawId: r.id, asset: r.tag,
    from: r.current_holder_name, to: r.to_user_name,
    requestedBy: r.requested_by_name, date: dateOnly(r.created_at),
    status: STATUS[r.status] || r.status, reason: r.reason || 'Transfer request.',
    allocationId: r.allocation_id, toUserId: r.to_user_id,
  };
}

function normalizeBooking(r) {
  return {
    id: 'BK-' + r.id, rawId: r.id, resource: r.tag, resourceName: r.asset_name,
    by: r.booked_by_name, title: r.purpose || 'Booking',
    date: dateOnly(r.starts_at), start: hhmm(r.starts_at), end: hhmm(r.ends_at),
    status: BOOKING_TITLE[r.status] || r.status,
  };
}

function normalizeEmployee(e) {
  return { id: e.id, name: e.name, email: e.email, role: e.role, dept: deptSlugByName(e.department_name), deptName: e.department_name, active: e.is_active !== false };
}

// ===================================================================== AUTH ==
// Signup always creates an employee; there is deliberately no role field.
const USER_KEY = 'af_user';
export function currentUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
}
function rememberUser(u) {
  try { u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY); } catch { /* ignore */ }
}

export async function login(credentials) {
  const data = await request('/auth/login', { method: 'POST', body: credentials });
  if (data && data.token) { setToken(data.token); rememberUser(data.user); }
  return data; // { token, user }
}
export async function signup(details) {
  const data = await request('/auth/signup', { method: 'POST', body: details });
  if (data && data.token) { setToken(data.token); rememberUser(data.user); }
  return data; // { token, user }
}
export function me() {
  // refresh the stored identity too, so a promotion shows up on next load
  return request('/auth/me').then((d) => { if (d && d.user) rememberUser(d.user); return d; });
}
export function logout() { clearToken(); rememberUser(null); }

// =================================================================== ASSETS ==
export function getAssets() {
  return read('/assets', () => demo.assets, (rows) => { rememberAssets(rows); return rows.map(normalizeAsset); });
}
export function getAsset(tag) {
  const id = cache.assetIdByTag[tag];
  const path = '/assets/' + encodeURIComponent(id != null ? id : tag);
  return read(path, () => demo.assets.find((a) => a.tag === tag) || null, (r) => (r ? normalizeAsset(r) : null));
}
export function getCategories() {
  return read('/categories', () => demo.categories, (rows) => {
    rememberCategories(rows);
    // superset shape: raw API fields plus the aliases the Organization screen reads
    return rows.map((c) => ({
      ...c,
      count: Number(c.asset_count ?? 0),
      active: c.is_active !== false,
      fields: (c.extra_fields || []).map((f) => ({
        key: f.key ?? f.name, label: f.label ?? f.name ?? f.key, type: f.type || 'text',
      })),
    }));
  });
}
export async function createAsset(asset) {
  // Resolve the live integer category_id from the demo slug's display name.
  const catName = (demo.categories.find((c) => c.id === asset.cat) || {}).name;
  await ensureCategories();
  const category_id = cache.catIdByName[catName];
  const body = {
    name: asset.name, category_id,
    serial_number: asset.serial && asset.serial !== '—' ? asset.serial : null,
    acquisition_date: asset.acq || null,
    acquisition_cost: asset.cost != null ? Number(asset.cost) : null,
    condition: asset.cond || null, location: asset.loc || null,
    photo_url: asset.img || null, extra: asset.extra || {}, is_bookable: !!asset.bookable,
  };
  const created = await request('/assets', { method: 'POST', body });
  return { ok: true, asset: normalizeAsset({ ...created, category_name: catName }) };
}

// ================================================== ALLOCATION & TRANSFER ==
export function getAllocations() {
  return read('/allocations?open=true', () => demo.allocations.filter((a) => a.status === 'Active'), (rows) => rows.map(normalizeAllocation));
}
export function getTransfers() {
  return read('/transfers', () => demo.transfers, (rows) => rows.map(normalizeTransfer));
}
export async function allocateAsset(payload) {
  // payload from the screen: { asset (tag), to (slug/int), toType, expReturn }
  await Promise.all([ensureAssets(), ensureEmployees()]);
  const asset_id = cache.assetIdByTag[payload.asset];
  if (payload.toType === 'department') {
    const err = new Error('Department-pool allocation is not supported by the API yet — allocate to a person.');
    err.errors = { holder_id: err.message };
    throw err;
  }
  const holder_id = resolveUserId(payload.to);
  const body = { asset_id, holder_id, expected_return_date: payload.expReturn || null };
  const created = await request('/allocations', { method: 'POST', body });
  return { ok: true, allocation: created };
}
export async function returnAsset(payload) {
  // payload.id is the live allocation id (from getAllocations)
  const created = await request('/allocations/' + encodeURIComponent(payload.id) + '/return', { method: 'POST', body: { notes: payload.notes || null } });
  return { ok: true, allocation: created };
}
export async function requestTransfer(payload) {
  // Needs the open allocation's id for the asset + the target user id.
  await ensureEmployees();
  const to_user_id = resolveUserId(payload.to);
  let allocation_id = payload.allocationId;
  if (!allocation_id) {
    try {
      const open = await request('/allocations?open=true');
      const match = open.find((a) => a.tag === payload.asset);
      allocation_id = match && match.id;
    } catch { /* fall through to a clear error below */ }
  }
  if (!allocation_id) throw new Error('Could not find the current allocation to transfer.');
  const created = await request('/transfers', { method: 'POST', body: { allocation_id, to_user_id } });
  return { ok: true, transfer: created };
}
export async function decideTransfer(rawId, approve) {
  const updated = await request('/transfers/' + encodeURIComponent(rawId) + '/decide', { method: 'POST', body: { approve } });
  return { ok: true, transfer: updated };
}

// ================================================================= BOOKINGS ==
export function getBookings() {
  return read('/bookings', () => demo.bookings, (rows) => { rememberAssets(rows.map((r) => ({ tag: r.tag, id: r.asset_id }))); return rows.map(normalizeBooking); });
}
export async function createBooking(payload) {
  await ensureAssets();
  const asset_id = cache.assetIdByTag[payload.resource];
  const body = { asset_id, starts_at: payload.date + 'T' + payload.start, ends_at: payload.date + 'T' + payload.end, purpose: payload.title || null };
  const created = await request('/bookings', { method: 'POST', body });
  return { ok: true, booking: normalizeBooking(created) };
}
export async function cancelBooking(id) {
  const rawId = typeof id === 'string' && id.startsWith('BK-') ? id.slice(3) : id;
  const updated = await request('/bookings/' + encodeURIComponent(rawId) + '/cancel', { method: 'POST' });
  return { ok: true, booking: normalizeBooking(updated) };
}
export async function rescheduleBooking(id, payload) {
  const rawId = typeof id === 'string' && id.startsWith('BK-') ? id.slice(3) : id;
  const body = { starts_at: payload.date + 'T' + payload.start, ends_at: payload.date + 'T' + payload.end };
  const updated = await request('/bookings/' + encodeURIComponent(rawId), { method: 'PATCH', body });
  return { ok: true, booking: normalizeBooking(updated) };
}

// ============================================ ORG / PEOPLE (shared reads) ==
export function getEmployees() {
  return read('/employees', () => demo.employees, (rows) => { rememberEmployees(rows); return rows.map(normalizeEmployee); });
}
export function getDepartments() {
  // dbId carries the real integer key for writes; id stays the slug the screens key on
  return read('/departments', () => demo.departments, (rows) => rows.map((d) => ({ id: deptSlugByName(d.name), dbId: d.id, name: d.name, head: d.head_id, parent: d.parent_id, active: d.is_active !== false, memberCount: d.member_count })));
}
export function getNotifications() {
  return read('/notifications', () => demo.notifications, (rows) => rows);
}

// ================== live-shape adapters for the remaining screens ==========
// (Organization / Maintenance / Audits / Reports / Notifications were built
// against the prototype's demo shapes; these map the API's rows into supersets
// of that shape so the screens render unchanged.)

const num = (id) => String(id).replace(/\D/g, '');
const title = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function markNotificationRead(id) {
  return request('/notifications/' + num(id) + '/read', { method: 'POST' });
}
export function markAllNotificationsRead() {
  return request('/notifications/read-all', { method: 'POST' });
}

const NOTIF_KIND = (t) =>
  t.startsWith('booking') ? 'booking' : t.startsWith('maintenance') ? 'maintenance'
  : t.startsWith('transfer') ? 'transfer' : t.startsWith('audit') ? 'audit'
  : t === 'overdue_return' ? 'overdue' : 'assigned';
const NOTIF_ICON = { booking: 'calendar', maintenance: 'wrench', transfer: 'swap', audit: 'clipboard', overdue: 'alert', assigned: 'box' };

export function getNotificationsLive() {
  return request('/notifications').then((data) => (data.notifications || []).map((n) => {
    const kind = NOTIF_KIND(n.type);
    const p = n.payload || {};
    return {
      ...n, type: kind, icon: NOTIF_ICON[kind],
      title: `${title(n.type)}${p.asset ? ' — ' + p.asset : ''}`,
      body: [p.asset, p.by && `by ${p.by}`, p.due && `due ${String(p.due).slice(0, 10)}`,
             p.starts_at && `starts ${new Date(p.starts_at).toLocaleString()}`]
        .filter(Boolean).join(' · ') || title(n.type),
      time: n.created_at, unread: !n.read_at,
    };
  }));
}

export function getActivity(params) {
  return request('/activity' + qs(params)).then((rows) => rows.map((r) => [
    (r.created_at || '').replace('T', ' ').slice(0, 16),
    r.actor_name || 'system',
    title(r.entity),
    `${title(r.action)} ${r.entity} ${r.entity_id ?? ''}`.trim(),
  ]));
}

// --- organization writes ---
export function createDepartment(payload) {
  return request('/departments', {
    method: 'POST',
    body: { name: payload.name, parent_id: payload.parent_id ?? null, head_id: payload.head_id ?? null },
  });
}
export function updateDepartment(id, patch) {
  const body = { ...patch };
  if ('active' in body) { body.is_active = body.active; delete body.active; }
  return request('/departments/' + num(id), { method: 'PATCH', body });
}
export function createCategory(payload) {
  return request('/categories', {
    method: 'POST',
    body: { name: payload.name, extra_fields: payload.fields ?? payload.extra_fields ?? [] },
  });
}
export function updateCategory(id, patch) {
  const body = { ...patch };
  if ('fields' in body) { body.extra_fields = body.fields; delete body.fields; }
  if ('active' in body) { body.is_active = body.active; delete body.active; }
  return request('/categories/' + num(id), { method: 'PATCH', body });
}
const ROLE_ENUM = { admin: 'admin', 'asset manager': 'asset_manager', 'dept head': 'department_head', 'department head': 'department_head', employee: 'employee' };
export function updateEmployee(id, patch) {
  const body = { ...patch };
  if (body.role) body.role = ROLE_ENUM[String(body.role).toLowerCase()] || body.role;
  if ('active' in body) { body.is_active = body.active; delete body.active; }
  return request('/employees/' + num(id), { method: 'PATCH', body });
}

// --- maintenance ---
const STAGE = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', assigned: 'Technician Assigned', in_progress: 'In Progress', resolved: 'Resolved' };
function normalizeMaintenance(m) {
  const hist = [[String(m.created_at).slice(0, 10), `Raised by ${m.raised_by_name || 'employee'}`]];
  if (m.decided_by_name) hist.push([String(m.created_at).slice(0, 10), `${m.status === 'rejected' ? 'Rejected' : 'Approved'} by ${m.decided_by_name}`]);
  if (m.technician) hist.push([String(m.created_at).slice(0, 10), `Technician assigned — ${m.technician}`]);
  if (m.resolved_at) hist.push([String(m.resolved_at).slice(0, 10), 'Resolved']);
  return {
    ...m, asset: m.tag, by: m.raised_by_name, date: String(m.created_at).slice(0, 10),
    priority: title(m.priority), stage: STAGE[m.status] || title(m.status),
    tech: m.technician, issue: m.description, photo: !!m.photo_url,
    resolved: m.resolved_at ? String(m.resolved_at).slice(0, 10) : undefined, history: hist,
  };
}
export function getMaintenance(params) {
  return request('/maintenance' + qs(params)).then((rows) => rows.map(normalizeMaintenance));
}
export async function createMaintenance(payload) {
  await ensureAssets();
  // screens pass either an asset tag (AF-0003) or a numeric id
  const raw = payload.asset ?? payload.asset_id;
  const asset_id = cache.assetIdByTag[raw] ?? (Number.isInteger(raw) ? raw : Number(num(raw)));
  const created = await request('/maintenance', {
    method: 'POST',
    body: { asset_id, description: payload.issue ?? payload.description, priority: String(payload.priority || 'medium').toLowerCase(), photo_url: payload.photo_url ?? null },
  });
  return { ok: true, maintenance: normalizeMaintenance(created) };
}
export function decideMaintenance(id, payload) {
  const approve = typeof payload === 'boolean' ? payload : !!(payload && payload.approve);
  return request('/maintenance/' + num(id) + '/decide', { method: 'POST', body: { approve } }).then(normalizeMaintenance);
}
export function assignMaintenance(id, payload) {
  const technician = typeof payload === 'string' ? payload : payload && (payload.technician ?? payload.tech);
  return request('/maintenance/' + num(id) + '/assign', { method: 'POST', body: { technician } }).then(normalizeMaintenance);
}
export function startMaintenance(id) {
  return request('/maintenance/' + num(id) + '/start', { method: 'POST' }).then(normalizeMaintenance);
}
export function resolveMaintenance(id) {
  return request('/maintenance/' + num(id) + '/resolve', { method: 'POST' }).then(normalizeMaintenance);
}

// --- audits ---
function normalizeAuditCycle(a) {
  return {
    ...a, name: a.name,
    scopeType: a.location ? 'Location' : a.department_name ? 'Department' : 'All',
    scope: a.location || a.department_name || 'All assets',
    dept: a.department_id, from: String(a.starts_on).slice(0, 10), to: String(a.ends_on).slice(0, 10),
    // list rows carry auditor names, detail rows carry {id, name} objects
    auditors: (a.auditors || []).map((x) => (x && x.name) ? x.name : x),
    status: a.closed_at ? 'Closed' : 'In Progress',
    closed: a.closed_at ? String(a.closed_at).slice(0, 10) : undefined,
    items: (a.assets || []).map((x) => ({
      asset: x.tag, asset_id: x.id, result: x.result ? title(x.result) : null, note: x.notes || '',
    })),
  };
}
export function getAudits() {
  return request('/audits').then((rows) => rows.map(normalizeAuditCycle));
}
export function getAudit(id) {
  return request('/audits/' + num(id)).then(normalizeAuditCycle);
}
export async function createAudit(payload) {
  const auditor_ids = await Promise.all((payload.auditors || payload.auditor_ids || []).map(resolveUserId));
  return request('/audits', {
    method: 'POST',
    body: {
      name: payload.name,
      starts_on: payload.from ?? payload.starts_on, ends_on: payload.to ?? payload.ends_on,
      location: payload.scopeType === 'Location' ? payload.scope : null,
      department_id: payload.scopeType === 'Department' ? (payload.department_id ?? payload.dept ?? null) : null,
      auditor_ids,
    },
  });
}
export async function saveAuditRecord(id, payload) {
  // un-marking is a local-only affordance; records are append/overwrite server-side
  if (!payload.result) return { ok: true, skipped: true };
  await ensureAssets();
  const raw = payload.asset_id ?? payload.asset;
  const asset_id = cache.assetIdByTag[raw] ?? (Number.isInteger(raw) ? raw : Number(num(raw)));
  return request('/audits/' + num(id) + '/records', {
    method: 'POST',
    body: { asset_id, result: String(payload.result).toLowerCase(), notes: payload.note ?? payload.notes ?? null },
  });
}
export function getAuditDiscrepancies(id) {
  return request('/audits/' + num(id) + '/discrepancies');
}
export function closeAudit(id) {
  return request('/audits/' + num(id) + '/close', { method: 'POST' });
}

// --- reports ---
export function getUnreadCount() { return request('/notifications').then((d) => d.unread ?? 0); }
export function getReportSummary() { return request('/reports/summary'); }
export function getReportUtilization() { return request('/reports/utilization'); }
export function getReportHeatmap() { return request('/reports/booking-heatmap'); }

function qs(params) {
  if (!params) return '';
  const p = Object.entries(params).filter(([, v]) => v != null && v !== '');
  return p.length ? '?' + p.map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&') : '';
}

const api = {
  BASE, request, getToken, setToken, clearToken,
  login, signup, me, logout, currentUser, getUnreadCount,
  getAssets, getAsset, getCategories, createAsset,
  getAllocations, getTransfers, allocateAsset, returnAsset, requestTransfer, decideTransfer,
  getBookings, createBooking, cancelBooking, rescheduleBooking,
  getEmployees, getDepartments,
  getNotifications: getNotificationsLive, markNotificationRead, markAllNotificationsRead, getActivity,
  createDepartment, updateDepartment, createCategory, updateCategory, updateEmployee,
  getMaintenance, createMaintenance, decideMaintenance, assignMaintenance, startMaintenance, resolveMaintenance,
  getAudits, getAudit, createAudit, saveAuditRecord, getAuditDiscrepancies, closeAudit,
  getReportSummary, getReportUtilization, getReportHeatmap,
};
export default api;
