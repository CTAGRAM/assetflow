import { Router } from 'express';
import { query, tx, logActivity, notify } from './db.js';
import { requireAuth, requireRole } from './auth.js';
import { idParam } from './org.js';

export const router = Router();
router.use(requireAuth);

// audit scope: explicit location match, or assets currently held by the
// scoped department's members; no scope means every non-disposed asset
const SCOPE = `
  select a.id, a.tag, a.name, a.status, a.location from assets a
  where a.status <> 'disposed'
    and ($2::text is null or a.location ilike '%' || $2 || '%')
    and ($3::int is null or exists (
      select 1 from allocations al join users u on u.id = al.holder_id
      where al.asset_id = a.id and al.returned_at is null and u.department_id = $3))`;

router.get('/', async (_req, res) => {
  const { rows } = await query(
    `select ac.*, u.name as created_by_name, d.name as department_name,
            (select count(*) from audit_records r where r.cycle_id = ac.id) as checked_count,
            (select count(*) from audit_records r where r.cycle_id = ac.id and r.result <> 'verified') as flagged_count,
            (select array_agg(au.name) from audit_assignments aa join users au on au.id = aa.auditor_id
             where aa.cycle_id = ac.id) as auditors
     from audit_cycles ac
     join users u on u.id = ac.created_by
     left join departments d on d.id = ac.department_id
     order by ac.starts_on desc`);
  res.json(rows);
});

router.post('/', requireRole('admin'), async (req, res) => {
  const { name, department_id, location, starts_on, ends_on, auditor_ids } = req.body ?? {};
  const errors = {};
  if (!name?.trim()) errors.name = 'Give the audit cycle a name.';
  if (!starts_on || isNaN(Date.parse(starts_on))) errors.starts_on = 'Enter a valid start date.';
  if (!ends_on || isNaN(Date.parse(ends_on))) errors.ends_on = 'Enter a valid end date.';
  if (!errors.starts_on && !errors.ends_on && Date.parse(ends_on) < Date.parse(starts_on))
    errors.ends_on = 'End date cannot be before the start date.';
  if (!Array.isArray(auditor_ids) || !auditor_ids.length || !auditor_ids.every(Number.isInteger))
    errors.auditor_ids = 'Assign at least one auditor.';
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  try {
    const cycle = await tx(async (c) => {
      const { rows: [ac] } = await c.query(
        `insert into audit_cycles (name, department_id, location, starts_on, ends_on, created_by)
         values ($1, $2, $3, $4, $5, $6) returning *`,
        [name.trim(), department_id ?? null, location ?? null, starts_on, ends_on, req.user.id]);
      for (const uid of [...new Set(auditor_ids)])
        await c.query('insert into audit_assignments (cycle_id, auditor_id) values ($1, $2)', [ac.id, uid]);
      return ac;
    });
    for (const uid of new Set(auditor_ids))
      await notify(uid, 'audit_assigned', { cycle: cycle.name, ends_on });
    await logActivity(req.user.id, 'created', 'audit_cycle', cycle.id, { name: cycle.name });
    res.status(201).json(cycle);
  } catch (e) {
    if (e.code === '23503') return res.status(400).json({ error: 'An auditor or department in the list does not exist.' });
    throw e;
  }
});

router.get('/:id', async (req, res) => {
  const id = idParam(req, res);
  if (!id) return;
  const { rows: [cycle] } = await query('select * from audit_cycles where id = $1', [id]);
  if (!cycle) return res.status(404).json({ error: 'Audit cycle not found.' });
  const [auditors, assets] = await Promise.all([
    query(`select u.id, u.name from audit_assignments aa join users u on u.id = aa.auditor_id where aa.cycle_id = $1`, [id]),
    query(
      `with scope as (${SCOPE})
       select s.*, r.result, r.notes, r.checked_at, ru.name as checked_by
       from scope s
       left join audit_records r on r.cycle_id = $1 and r.asset_id = s.id
       left join users ru on ru.id = r.auditor_id
       order by s.tag`,
      [id, cycle.location, cycle.department_id]),
  ]);
  res.json({ ...cycle, auditors: auditors.rows, assets: assets.rows });
});

router.post('/:id/records', async (req, res) => {
  const id = idParam(req, res);
  if (!id) return;
  const { asset_id, result, notes } = req.body ?? {};
  const errors = {};
  if (!Number.isInteger(asset_id)) errors.asset_id = 'Pick an asset.';
  if (!['verified', 'missing', 'damaged'].includes(result))
    errors.result = 'Result must be verified, missing or damaged.';
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const { rows: [cycle] } = await query('select * from audit_cycles where id = $1', [id]);
  if (!cycle) return res.status(404).json({ error: 'Audit cycle not found.' });
  if (cycle.closed_at) return res.status(409).json({ error: 'This audit cycle is closed.' });
  const { rows: [assigned] } = await query(
    'select 1 from audit_assignments where cycle_id = $1 and auditor_id = $2', [id, req.user.id]);
  if (!assigned && req.user.role !== 'admin')
    return res.status(403).json({ error: 'You are not an auditor on this cycle.' });

  try {
    const { rows: [rec] } = await query(
      `insert into audit_records (cycle_id, asset_id, auditor_id, result, notes)
       values ($1, $2, $3, $4, $5)
       on conflict (cycle_id, asset_id)
       do update set result = excluded.result, notes = excluded.notes,
                     auditor_id = excluded.auditor_id, checked_at = now()
       returning *`,
      [id, asset_id, req.user.id, result, notes ?? null]);
    if (result !== 'verified') {
      const { rows: admins } = await query(`select id from users where role = 'admin' and is_active`);
      for (const a of admins) await notify(a.id, 'audit_discrepancy', { cycle: cycle.name, asset_id, result });
    }
    res.status(201).json(rec);
  } catch (e) {
    if (e.code === '23503') return res.status(400).json({ errors: { asset_id: 'That asset does not exist.' } });
    throw e;
  }
});

router.get('/:id/discrepancies', async (req, res) => {
  const id = idParam(req, res);
  if (!id) return;
  const { rows } = await query(
    `select r.*, a.tag, a.name as asset_name, a.location, u.name as auditor_name
     from audit_records r
     join assets a on a.id = r.asset_id
     join users u on u.id = r.auditor_id
     where r.cycle_id = $1 and r.result <> 'verified'
     order by r.checked_at desc`, [id]);
  res.json(rows);
});

// closing locks the cycle and applies verdicts: confirmed missing becomes lost
router.post('/:id/close', requireRole('admin'), async (req, res) => {
  const id = idParam(req, res);
  if (!id) return;
  const { rows: [cycle] } = await query('select * from audit_cycles where id = $1', [id]);
  if (!cycle) return res.status(404).json({ error: 'Audit cycle not found.' });
  if (cycle.closed_at) return res.status(409).json({ error: 'Already closed.' });

  const summary = await tx(async (c) => {
    await c.query('update audit_cycles set closed_at = now() where id = $1', [id]);
    const lost = await c.query(
      `update assets set status = 'lost'
       where id in (select asset_id from audit_records where cycle_id = $1 and result = 'missing')
         and status not in ('retired', 'disposed')`, [id]);
    const { rows } = await c.query(
      `select result, count(*)::int as n from audit_records where cycle_id = $1 group by result`, [id]);
    return { marked_lost: lost.rowCount, results: Object.fromEntries(rows.map(r => [r.result, r.n])) };
  });
  await logActivity(req.user.id, 'closed', 'audit_cycle', id, summary);
  res.json({ ...cycle, closed_at: new Date().toISOString(), summary });
});
