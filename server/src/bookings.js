import { Router } from 'express';
import { query, logActivity, notify } from './db.js';
import { requireAuth } from './auth.js';
import { idParam } from './org.js';

export const router = Router();
router.use(requireAuth);

const MANAGER_ROLES = ['admin', 'asset_manager', 'department_head'];

// stored status is only upcoming/cancelled; ongoing and completed follow from the clock
const BOOKING_SELECT = `
  select b.id, b.asset_id, b.booked_by, b.purpose, b.created_at,
         lower(b.slot) as starts_at, upper(b.slot) as ends_at,
         a.tag, a.name as asset_name, u.name as booked_by_name,
         case when b.status = 'cancelled' then 'cancelled'
              when upper(b.slot) <= now() then 'completed'
              when b.slot @> now() then 'ongoing'
              else 'upcoming' end as status
  from bookings b
  join assets a on a.id = b.asset_id
  join users u on u.id = b.booked_by`;

function validSlot(starts_at, ends_at) {
  const errors = {};
  if (!starts_at || isNaN(Date.parse(starts_at))) errors.starts_at = 'Enter a valid start time.';
  if (!ends_at || isNaN(Date.parse(ends_at))) errors.ends_at = 'Enter a valid end time.';
  if (!errors.starts_at && !errors.ends_at && Date.parse(ends_at) <= Date.parse(starts_at))
    errors.ends_at = 'End time must be after the start time.';
  return errors;
}

async function conflictMessage(asset_id, starts_at, ends_at) {
  const { rows: [hit] } = await query(
    `${BOOKING_SELECT}
     where b.asset_id = $1 and b.status <> 'cancelled' and b.slot && tstzrange($2, $3, '[)')
     limit 1`, [asset_id, starts_at, ends_at]);
  return hit
    ? `That slot overlaps ${hit.booked_by_name}'s booking (${new Date(hit.starts_at).toLocaleString('en-IN')} to ${new Date(hit.ends_at).toLocaleTimeString('en-IN')}). Pick a free window.`
    : 'That slot overlaps an existing booking. Pick a free window.';
}

router.get('/', async (req, res) => {
  const { asset_id, mine, from, to } = req.query;
  const { rows } = await query(
    `${BOOKING_SELECT}
     where ($1::int is null or b.asset_id = $1)
       and ($2::int is null or b.booked_by = $2)
       and ($3::timestamptz is null or upper(b.slot) >= $3)
       and ($4::timestamptz is null or lower(b.slot) <= $4)
     order by lower(b.slot)`,
    [asset_id || null, mine === 'true' ? req.user.id : null, from || null, to || null]);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { asset_id, starts_at, ends_at, purpose } = req.body ?? {};
  const errors = validSlot(starts_at, ends_at);
  if (!Number.isInteger(asset_id)) errors.asset_id = 'Pick a resource.';
  if (!errors.starts_at && Date.parse(starts_at) < Date.now() - 60_000)
    errors.starts_at = 'Start time is in the past.';
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const { rows: [asset] } = await query('select id, tag, name, is_bookable, status from assets where id = $1', [asset_id]);
  if (!asset) return res.status(404).json({ error: 'Resource not found.' });
  if (!asset.is_bookable) return res.status(400).json({ errors: { asset_id: `${asset.name} (${asset.tag}) is not a bookable resource.` } });
  if (['retired', 'disposed', 'lost', 'under_maintenance'].includes(asset.status))
    return res.status(409).json({ error: `${asset.name} (${asset.tag}) is ${asset.status.replace('_', ' ')} and cannot be booked.` });

  try {
    const { rows: [b] } = await query(
      `insert into bookings (asset_id, booked_by, slot, purpose)
       values ($1, $2, tstzrange($3, $4, '[)'), $5) returning id`,
      [asset_id, req.user.id, starts_at, ends_at, purpose ?? null]);
    const { rows: [full] } = await query(`${BOOKING_SELECT} where b.id = $1`, [b.id]);
    await notify(req.user.id, 'booking_confirmed', { asset: `${asset.name} (${asset.tag})`, starts_at, ends_at });
    await logActivity(req.user.id, 'booked', 'asset', asset_id, { tag: asset.tag, starts_at, ends_at });
    res.status(201).json(full);
  } catch (e) {
    // 23P01: the exclusion constraint rejected an overlap, even under a race
    if (e.code === '23P01') return res.status(409).json({ error: await conflictMessage(asset_id, starts_at, ends_at) });
    throw e;
  }
});

// reschedule: booker or a manager moves the slot
router.patch('/:id', async (req, res) => {
  const id = idParam(req, res);
  if (!id) return;
  const { starts_at, ends_at } = req.body ?? {};
  const errors = validSlot(starts_at, ends_at);
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const { rows: [b] } = await query('select * from bookings where id = $1', [id]);
  if (!b) return res.status(404).json({ error: 'Booking not found.' });
  if (b.booked_by !== req.user.id && !MANAGER_ROLES.includes(req.user.role))
    return res.status(403).json({ error: 'Only the person who booked it (or a manager) can change this booking.' });
  if (b.status === 'cancelled') return res.status(409).json({ error: 'This booking was cancelled; make a new one.' });

  try {
    await query(`update bookings set slot = tstzrange($2, $3, '[)') where id = $1`, [id, starts_at, ends_at]);
    const { rows: [full] } = await query(`${BOOKING_SELECT} where b.id = $1`, [id]);
    await logActivity(req.user.id, 'rescheduled', 'booking', id, { starts_at, ends_at });
    res.json(full);
  } catch (e) {
    if (e.code === '23P01') return res.status(409).json({ error: await conflictMessage(b.asset_id, starts_at, ends_at) });
    throw e;
  }
});

router.post('/:id/cancel', async (req, res) => {
  const id = idParam(req, res);
  if (!id) return;
  const { rows: [b] } = await query('select * from bookings where id = $1', [id]);
  if (!b) return res.status(404).json({ error: 'Booking not found.' });
  if (b.booked_by !== req.user.id && !MANAGER_ROLES.includes(req.user.role))
    return res.status(403).json({ error: 'Only the person who booked it (or a manager) can cancel this booking.' });
  if (b.status === 'cancelled') return res.status(409).json({ error: 'Already cancelled.' });

  await query(`update bookings set status = 'cancelled' where id = $1`, [id]);
  const { rows: [full] } = await query(`${BOOKING_SELECT} where b.id = $1`, [id]);
  await notify(b.booked_by, 'booking_cancelled', { booking_id: id, by: req.user.name });
  await logActivity(req.user.id, 'cancelled', 'booking', id, {});
  res.json(full);
});
