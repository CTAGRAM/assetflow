import { Router } from 'express';
import { query, tx, logActivity, notify } from './db.js';
import { requireAuth, requireRole } from './auth.js';
import { idParam } from './org.js';

export const router = Router();
router.use(requireAuth);

const M_SELECT = `
  select m.*, a.tag, a.name as asset_name, u.name as raised_by_name, d.name as decided_by_name
  from maintenance_requests m
  join assets a on a.id = m.asset_id
  join users u on u.id = m.raised_by
  left join users d on d.id = m.decided_by`;

router.get('/', async (req, res) => {
  const { status, asset_id, mine } = req.query;
  const { rows } = await query(
    `${M_SELECT}
     where ($1::text is null or m.status = $1::maintenance_status)
       and ($2::int is null or m.asset_id = $2)
       and ($3::int is null or m.raised_by = $3)
     order by m.created_at desc`,
    [status || null, asset_id || null, mine === 'true' ? req.user.id : null]);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { asset_id, description, priority, photo_url } = req.body ?? {};
  const errors = {};
  if (!Number.isInteger(asset_id)) errors.asset_id = 'Pick an asset.';
  if (!description?.trim()) errors.description = 'Describe the issue.';
  if (priority !== undefined && !['low', 'medium', 'high'].includes(priority))
    errors.priority = 'Priority must be low, medium or high.';
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const { rows: [asset] } = await query('select id, tag, name, status from assets where id = $1', [asset_id]);
  if (!asset) return res.status(404).json({ error: 'Asset not found.' });
  if (['retired', 'disposed', 'lost'].includes(asset.status))
    return res.status(409).json({ error: `${asset.name} (${asset.tag}) is ${asset.status} and cannot go for maintenance.` });

  const { rows: [m] } = await query(
    `insert into maintenance_requests (asset_id, raised_by, description, priority, photo_url)
     values ($1, $2, $3, $4, $5) returning *`,
    [asset_id, req.user.id, description.trim(), priority ?? 'medium', photo_url ?? null]);
  await logActivity(req.user.id, 'raised maintenance', 'asset', asset_id, { tag: asset.tag, priority: m.priority });
  res.status(201).json(m);
});

// each action is valid from exactly one state; anything else gets a clear 409
async function step(req, res, { from, to, patch = '', params = [], after }) {
  const id = idParam(req, res);
  if (!id) return;
  const { rows: [m] } = await query(`${M_SELECT} where m.id = $1`, [id]);
  if (!m) return res.status(404).json({ error: 'Maintenance request not found.' });
  if (m.status !== from)
    return res.status(409).json({ error: `This request is ${m.status.replace('_', ' ')}, not ${from.replace('_', ' ')}.` });
  const { rows: [updated] } = await query(
    `update maintenance_requests set status = $2 ${patch} where id = $1 returning *`,
    [id, to, ...params]);
  if (after) await after(m, updated);
  await logActivity(req.user.id, to.replace('_', ' '), 'maintenance', id, { tag: m.tag });
  res.json(updated);
}

router.post('/:id/decide', requireRole('admin', 'asset_manager'), async (req, res) => {
  const { approve } = req.body ?? {};
  if (typeof approve !== 'boolean') return res.status(400).json({ errors: { approve: 'Send approve: true or false.' } });
  await step(req, res, {
    from: 'pending',
    to: approve ? 'approved' : 'rejected',
    patch: ', decided_by = $3',
    params: [req.user.id],
    after: async (m) => {
      if (approve) await query(`update assets set status = 'under_maintenance' where id = $1`, [m.asset_id]);
      await notify(m.raised_by, approve ? 'maintenance_approved' : 'maintenance_rejected',
        { asset: `${m.asset_name} (${m.tag})`, by: req.user.name });
    },
  });
});

router.post('/:id/assign', requireRole('admin', 'asset_manager'), async (req, res) => {
  const { technician } = req.body ?? {};
  if (!technician?.trim()) return res.status(400).json({ errors: { technician: 'Technician name is required.' } });
  await step(req, res, { from: 'approved', to: 'assigned', patch: ', technician = $3', params: [technician.trim()] });
});

router.post('/:id/start', requireRole('admin', 'asset_manager'), async (req, res) => {
  await step(req, res, { from: 'assigned', to: 'in_progress' });
});

router.post('/:id/resolve', requireRole('admin', 'asset_manager'), async (req, res) => {
  await step(req, res, {
    from: 'in_progress',
    to: 'resolved',
    patch: ', resolved_at = now()',
    after: (m) => tx(async (c) => {
      // back to allocated if someone still holds it, otherwise available
      const { rows: [open] } = await c.query(
        'select id from allocations where asset_id = $1 and returned_at is null', [m.asset_id]);
      await c.query('update assets set status = $2 where id = $1', [m.asset_id, open ? 'allocated' : 'available']);
      await notify(m.raised_by, 'maintenance_resolved', { asset: `${m.asset_name} (${m.tag})` });
    }),
  });
});
