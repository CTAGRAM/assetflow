import { Router } from 'express';
import { query, logActivity } from './db.js';
import { requireAuth, requireRole } from './auth.js';
import { idParam } from './org.js';

export const router = Router();
router.use(requireAuth);

// statuses an asset manager may set by hand; the rest are driven by
// allocation, booking, maintenance and audit flows
const MANUAL_STATUSES = ['available', 'reserved', 'lost', 'retired', 'disposed'];

const BASE_SELECT = `
  select a.*, c.name as category_name,
         al.id as open_allocation_id, holder.id as holder_id, holder.name as holder_name
  from assets a
  join asset_categories c on c.id = a.category_id
  left join allocations al on al.asset_id = a.id and al.returned_at is null
  left join users holder on holder.id = al.holder_id`;

router.get('/', async (req, res) => {
  const { search, category_id, status, location, bookable } = req.query;
  const { rows } = await query(
    `${BASE_SELECT}
     where ($1::text is null or a.tag ilike '%' || $1 || '%' or a.name ilike '%' || $1 || '%' or a.serial_number ilike '%' || $1 || '%')
       and ($2::int is null or a.category_id = $2)
       and ($3::text is null or a.status = $3::asset_status)
       and ($4::text is null or a.location ilike '%' || $4 || '%')
       and ($5::boolean is null or a.is_bookable = $5)
     order by a.tag`,
    [search?.trim() || null, category_id || null, status || null, location?.trim() || null,
     bookable === undefined ? null : bookable === 'true']);
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const id = idParam(req, res);
  if (!id) return;
  const { rows: [asset] } = await query(`${BASE_SELECT} where a.id = $1`, [id]);
  if (!asset) return res.status(404).json({ error: 'Asset not found.' });
  const [allocations, maintenance] = await Promise.all([
    query(
      `select al.*, u.name as holder_name, by_u.name as allocated_by_name
       from allocations al
       join users u on u.id = al.holder_id
       join users by_u on by_u.id = al.allocated_by
       where al.asset_id = $1 order by al.allocated_at desc`, [id]),
    query(
      `select m.*, u.name as raised_by_name
       from maintenance_requests m join users u on u.id = m.raised_by
       where m.asset_id = $1 order by m.created_at desc`, [id]),
  ]);
  res.json({ ...asset, allocations: allocations.rows, maintenance: maintenance.rows });
});

router.post('/', requireRole('admin', 'asset_manager'), async (req, res) => {
  const { name, category_id, serial_number, acquisition_date, acquisition_cost,
          condition, location, photo_url, extra, is_bookable } = req.body ?? {};
  const errors = {};
  if (!name?.trim()) errors.name = 'Asset name is required.';
  if (!Number.isInteger(category_id)) errors.category_id = 'Pick a category.';
  if (acquisition_cost != null && (isNaN(acquisition_cost) || acquisition_cost < 0))
    errors.acquisition_cost = 'Cost must be a non-negative number.';
  if (acquisition_date != null && isNaN(Date.parse(acquisition_date)))
    errors.acquisition_date = 'Enter a valid date.';
  if (Object.keys(errors).length) return res.status(400).json({ errors });
  try {
    const { rows: [asset] } = await query(
      `insert into assets (name, category_id, serial_number, acquisition_date, acquisition_cost,
                           condition, location, photo_url, extra, is_bookable, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *`,
      [name.trim(), category_id, serial_number ?? null, acquisition_date ?? null, acquisition_cost ?? null,
       condition ?? null, location ?? null, photo_url ?? null, JSON.stringify(extra ?? {}),
       is_bookable ?? false, req.user.id]);
    await logActivity(req.user.id, 'registered', 'asset', asset.id, { tag: asset.tag, name: asset.name });
    res.status(201).json(asset);
  } catch (e) {
    if (e.code === '23503') return res.status(400).json({ errors: { category_id: 'That category does not exist.' } });
    throw e;
  }
});

router.patch('/:id', requireRole('admin', 'asset_manager'), async (req, res) => {
  const id = idParam(req, res);
  if (!id) return;
  const { rows: [current] } = await query('select * from assets where id = $1', [id]);
  if (!current) return res.status(404).json({ error: 'Asset not found.' });

  const { status } = req.body ?? {};
  if (status !== undefined) {
    if (!MANUAL_STATUSES.includes(status))
      return res.status(400).json({ errors: { status: `Only ${MANUAL_STATUSES.join(', ')} can be set manually; allocation, booking and maintenance flows drive the rest.` } });
    if (current.status === 'allocated') {
      const { rows: [h] } = await query(
        `select u.name from allocations al join users u on u.id = al.holder_id
         where al.asset_id = $1 and al.returned_at is null`, [id]);
      return res.status(409).json({ error: `${current.name} (${current.tag}) is currently held by ${h?.name ?? 'someone'}. Process a return first.` });
    }
  }
  if ('name' in (req.body ?? {}) && !req.body.name?.trim())
    return res.status(400).json({ errors: { name: 'Asset name cannot be empty.' } });

  const allowed = ['name', 'category_id', 'serial_number', 'acquisition_date', 'acquisition_cost',
                   'condition', 'location', 'photo_url', 'extra', 'is_bookable', 'status'];
  const fields = allowed.filter(f => f in (req.body ?? {}));
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update.' });
  try {
    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const vals = fields.map(f => f === 'extra' ? JSON.stringify(req.body[f] ?? {}) : f === 'name' ? req.body[f].trim() : req.body[f]);
    const { rows: [asset] } = await query(`update assets set ${sets} where id = $1 returning *`, [id, ...vals]);
    await logActivity(req.user.id, 'updated', 'asset', id, req.body);
    res.json(asset);
  } catch (e) {
    if (e.code === '23503') return res.status(400).json({ errors: { category_id: 'That category does not exist.' } });
    if (e.code === '22P02' || e.code === '22007' || e.code === '23514')
      return res.status(400).json({ error: 'One of the values has the wrong format.' });
    throw e;
  }
});
