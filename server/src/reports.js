import { Router } from 'express';
import { query } from './db.js';
import { requireAuth } from './auth.js';

export const router = Router();
router.use(requireAuth);

// dashboard KPI cards in one round trip
router.get('/summary', async (_req, res) => {
  const { rows: [s] } = await query(`
    select
      (select count(*) from assets where status = 'available')::int as available,
      (select count(*) from assets where status = 'allocated')::int as allocated,
      (select count(*) from assets where status = 'under_maintenance')::int as under_maintenance,
      (select count(*) from maintenance_requests where status in ('pending', 'approved', 'assigned', 'in_progress'))::int as open_maintenance,
      (select count(*) from bookings where status <> 'cancelled' and slot && tstzrange(now(), now() + interval '1 day'))::int as bookings_next_24h,
      (select count(*) from transfer_requests where status = 'pending')::int as pending_transfers,
      (select count(*) from allocations where returned_at is null and expected_return_date between current_date and current_date + 7)::int as returns_this_week,
      (select count(*) from allocations where returned_at is null and expected_return_date < current_date)::int as overdue_returns`);
  res.json(s);
});

// per-asset usage over the last 90 days: held days + booking hours
router.get('/utilization', async (_req, res) => {
  const { rows } = await query(`
    select a.id, a.tag, a.name, a.status, c.name as category_name,
      coalesce((
        select round(sum(extract(epoch from
          least(coalesce(al.returned_at, now()), now()) -
          greatest(al.allocated_at, now() - interval '90 days'))) / 86400, 1)
        from allocations al
        where al.asset_id = a.id and coalesce(al.returned_at, now()) > now() - interval '90 days'
      ), 0) as held_days_90d,
      coalesce((
        select round(sum(extract(epoch from
          least(upper(b.slot), now()) - greatest(lower(b.slot), now() - interval '90 days'))) / 3600, 1)
        from bookings b
        where b.asset_id = a.id and b.status <> 'cancelled'
          and b.slot && tstzrange(now() - interval '90 days', now())
      ), 0) as booked_hours_90d
    from assets a join asset_categories c on c.id = a.category_id
    where a.status not in ('retired', 'disposed')
    order by held_days_90d desc, booked_hours_90d desc`);
  res.json(rows);
});

router.get('/maintenance-frequency', async (_req, res) => {
  const { rows } = await query(`
    select a.id, a.tag, a.name, c.name as category_name,
           count(m.id)::int as request_count,
           count(m.id) filter (where m.created_at > now() - interval '90 days')::int as last_90d
    from assets a
    join asset_categories c on c.id = a.category_id
    left join maintenance_requests m on m.asset_id = a.id
    group by a.id, a.tag, a.name, c.name
    having count(m.id) > 0
    order by request_count desc`);
  res.json(rows);
});

// weekday x hour counts for non-cancelled bookings, drives the peak-usage heatmap
router.get('/booking-heatmap', async (_req, res) => {
  const { rows } = await query(`
    select extract(isodow from lower(slot))::int as weekday,
           extract(hour from lower(slot))::int as hour,
           count(*)::int as bookings
    from bookings where status <> 'cancelled'
    group by 1, 2 order by 1, 2`);
  res.json(rows);
});

router.get('/department-allocation', async (_req, res) => {
  const { rows } = await query(`
    select d.id, d.name,
           count(al.id) filter (where al.returned_at is null)::int as open_allocations,
           count(al.id)::int as all_time
    from departments d
    left join users u on u.department_id = d.id
    left join allocations al on al.holder_id = u.id
    group by d.id, d.name order by open_allocations desc`);
  res.json(rows);
});
