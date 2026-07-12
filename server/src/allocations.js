import { Router } from 'express';
import { query, tx, logActivity, notify } from './db.js';
import { requireAuth, requireRole } from './auth.js';
import { idParam } from './org.js';

export const router = Router();
router.use(requireAuth);

const ALLOC_SELECT = `
  select al.*, a.tag, a.name as asset_name, a.status as asset_status,
         h.name as holder_name, by_u.name as allocated_by_name,
         (al.returned_at is null and al.expected_return_date < current_date) as overdue
  from allocations al
  join assets a on a.id = al.asset_id
  join users h on h.id = al.holder_id
  join users by_u on by_u.id = al.allocated_by`;

router.get('/allocations', async (req, res) => {
  const { open, overdue, holder_id, mine } = req.query;
  const { rows } = await query(
    `${ALLOC_SELECT}
     where ($1::boolean is null or (al.returned_at is null) = $1)
       and ($2::boolean is not true or (al.returned_at is null and al.expected_return_date < current_date))
       and ($3::int is null or al.holder_id = $3)
     order by al.allocated_at desc`,
    [open === undefined ? null : open === 'true', overdue === 'true',
     mine === 'true' ? req.user.id : holder_id || null]);
  res.json(rows);
});

router.post('/allocations', requireRole('admin', 'asset_manager', 'department_head'), async (req, res) => {
  const { asset_id, holder_id, department_id, expected_return_date } = req.body ?? {};
  const errors = {};
  if (!Number.isInteger(asset_id)) errors.asset_id = 'Pick an asset.';
  if (!Number.isInteger(holder_id)) errors.holder_id = 'Pick an employee.';
  if (expected_return_date != null && isNaN(Date.parse(expected_return_date)))
    errors.expected_return_date = 'Enter a valid date.';
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const { rows: [asset] } = await query(
    `select a.*, h.name as holder_name from assets a
     left join allocations al on al.asset_id = a.id and al.returned_at is null
     left join users h on h.id = al.holder_id where a.id = $1`, [asset_id]);
  if (!asset) return res.status(404).json({ error: 'Asset not found.' });
  if (asset.status === 'allocated')
    return res.status(409).json({
      error: `${asset.name} (${asset.tag}) is currently held by ${asset.holder_name}. Raise a transfer request instead.`,
      suggestion: 'transfer',
    });
  if (!['available', 'reserved'].includes(asset.status))
    return res.status(409).json({ error: `${asset.name} (${asset.tag}) is ${asset.status.replace('_', ' ')} and cannot be allocated.` });

  const { rows: [holder] } = await query('select id, name, is_active from users where id = $1', [holder_id]);
  if (!holder?.is_active) return res.status(400).json({ errors: { holder_id: 'That employee does not exist or is deactivated.' } });

  try {
    const alloc = await tx(async (c) => {
      const { rows: [al] } = await c.query(
        `insert into allocations (asset_id, holder_id, department_id, allocated_by, expected_return_date)
         values ($1, $2, $3, $4, $5) returning *`,
        [asset_id, holder_id, department_id ?? null, req.user.id, expected_return_date ?? null]);
      await c.query(`update assets set status = 'allocated' where id = $1`, [asset_id]);
      return al;
    });
    await notify(holder_id, 'asset_assigned', { asset: `${asset.name} (${asset.tag})`, by: req.user.name });
    await logActivity(req.user.id, 'allocated', 'asset', asset_id, { tag: asset.tag, to: holder.name });
    res.status(201).json(alloc);
  } catch (e) {
    // two managers racing: the partial unique index wins, not the second insert
    if (e.code === '23505') return res.status(409).json({ error: `${asset.name} (${asset.tag}) was just allocated by someone else.` });
    throw e;
  }
});

router.post('/allocations/:id/return', requireRole('admin', 'asset_manager', 'department_head'), async (req, res) => {
  const id = idParam(req, res);
  if (!id) return;
  const { notes } = req.body ?? {};
  const result = await tx(async (c) => {
    const { rows: [al] } = await c.query(
      'update allocations set returned_at = now(), return_notes = $2 where id = $1 and returned_at is null returning *',
      [id, notes ?? null]);
    if (!al) return null;
    await c.query(`update assets set status = 'available' where id = $1`, [al.asset_id]);
    return al;
  });
  if (!result) return res.status(409).json({ error: 'This allocation is already returned or does not exist.' });
  await logActivity(req.user.id, 'returned', 'asset', result.asset_id, { allocation_id: id, notes: notes ?? null });
  res.json(result);
});

// ---- transfers ----

router.get('/transfers', async (req, res) => {
  const { rows } = await query(
    `select t.*, a.tag, a.name as asset_name,
            req_u.name as requested_by_name, to_u.name as to_user_name,
            cur.name as current_holder_name, dec_u.name as decided_by_name
     from transfer_requests t
     join allocations al on al.id = t.allocation_id
     join assets a on a.id = al.asset_id
     join users req_u on req_u.id = t.requested_by
     join users to_u on to_u.id = t.to_user_id
     join users cur on cur.id = al.holder_id
     left join users dec_u on dec_u.id = t.decided_by
     where ($1::text is null or t.status = $1::request_status)
     order by t.created_at desc`,
    [req.query.status || null]);
  res.json(rows);
});

// any signed-in user can request a transfer; managers decide
router.post('/transfers', async (req, res) => {
  const { allocation_id, to_user_id } = req.body ?? {};
  const errors = {};
  if (!Number.isInteger(allocation_id)) errors.allocation_id = 'Pick the current allocation.';
  if (!Number.isInteger(to_user_id)) errors.to_user_id = 'Pick who should receive the asset.';
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const { rows: [al] } = await query(
    `select al.*, a.tag, a.name as asset_name from allocations al
     join assets a on a.id = al.asset_id where al.id = $1`, [allocation_id]);
  if (!al) return res.status(404).json({ error: 'Allocation not found.' });
  if (al.returned_at) return res.status(409).json({ error: 'That allocation is already closed; allocate the asset directly.' });
  if (al.holder_id === to_user_id) return res.status(400).json({ errors: { to_user_id: 'They already hold this asset.' } });

  const { rows: [target] } = await query('select id, name, is_active from users where id = $1', [to_user_id]);
  if (!target?.is_active) return res.status(400).json({ errors: { to_user_id: 'That employee does not exist or is deactivated.' } });

  const { rows: [t] } = await query(
    'insert into transfer_requests (allocation_id, requested_by, to_user_id) values ($1, $2, $3) returning *',
    [allocation_id, req.user.id, to_user_id]);
  await logActivity(req.user.id, 'requested transfer', 'asset', al.asset_id, { tag: al.tag, to: target.name });
  res.status(201).json(t);
});

router.post('/transfers/:id/decide', requireRole('admin', 'asset_manager', 'department_head'), async (req, res) => {
  const id = idParam(req, res);
  if (!id) return;
  const { approve } = req.body ?? {};
  if (typeof approve !== 'boolean') return res.status(400).json({ errors: { approve: 'Send approve: true or false.' } });

  const { rows: [t] } = await query(
    `select t.*, al.asset_id, al.holder_id, a.tag, a.name as asset_name
     from transfer_requests t
     join allocations al on al.id = t.allocation_id
     join assets a on a.id = al.asset_id
     where t.id = $1`, [id]);
  if (!t) return res.status(404).json({ error: 'Transfer request not found.' });
  if (t.status !== 'pending') return res.status(409).json({ error: `This request was already ${t.status}.` });

  if (!approve) {
    const { rows: [updated] } = await query(
      `update transfer_requests set status = 'rejected', decided_by = $2, decided_at = now() where id = $1 returning *`,
      [id, req.user.id]);
    await notify(t.requested_by, 'transfer_rejected', { asset: `${t.asset_name} (${t.tag})`, by: req.user.name });
    await logActivity(req.user.id, 'rejected transfer', 'asset', t.asset_id, { tag: t.tag });
    return res.json(updated);
  }

  const updated = await tx(async (c) => {
    await c.query(
      `update transfer_requests set status = 'approved', decided_by = $2, decided_at = now() where id = $1`,
      [id, req.user.id]);
    const { rows: [closed] } = await c.query(
      `update allocations set returned_at = now(), return_notes = 'transferred' where id = $1 and returned_at is null returning id`,
      [t.allocation_id]);
    if (!closed) throw Object.assign(new Error('allocation already closed'), { expected: 409, msg: 'The current allocation was closed in the meantime; allocate the asset directly.' });
    const { rows: [al] } = await c.query(
      `insert into allocations (asset_id, holder_id, allocated_by) values ($1, $2, $3) returning *`,
      [t.asset_id, t.to_user_id, req.user.id]);
    return al;
  }).catch(e => { if (e.expected) { res.status(e.expected).json({ error: e.msg }); return null; } throw e; });
  if (!updated) return;

  await notify(t.to_user_id, 'asset_assigned', { asset: `${t.asset_name} (${t.tag})`, by: req.user.name, via: 'transfer' });
  await notify(t.requested_by, 'transfer_approved', { asset: `${t.asset_name} (${t.tag})`, by: req.user.name });
  await logActivity(req.user.id, 'approved transfer', 'asset', t.asset_id, { tag: t.tag, transfer_id: id });
  res.json(updated);
});
