import { query, notify } from './db.js';

// Time-driven notifications the request handlers can't produce:
// a reminder shortly before a booking starts, and an alert when an
// allocation passes its expected return date. Runs every few minutes;
// the not-exists guard against the notifications table keeps each
// reminder/alert to exactly one send without extra schema.

const REMIND_BEFORE = '30 minutes';

async function bookingReminders() {
  const { rows } = await query(`
    select b.id, b.booked_by, a.name, a.tag, lower(b.slot) as starts_at
    from bookings b join assets a on a.id = b.asset_id
    where b.status <> 'cancelled'
      and lower(b.slot) between now() and now() + interval '${REMIND_BEFORE}'
      and not exists (
        select 1 from notifications n
        where n.type = 'booking_reminder' and (n.payload->>'booking_id')::int = b.id)`);
  for (const b of rows)
    await notify(b.booked_by, 'booking_reminder',
      { booking_id: b.id, asset: `${b.name} (${b.tag})`, starts_at: b.starts_at });
  return rows.length;
}

async function overdueAlerts() {
  const { rows } = await query(`
    select al.id, al.holder_id, al.expected_return_date, a.name, a.tag
    from allocations al join assets a on a.id = al.asset_id
    where al.returned_at is null and al.expected_return_date < current_date
      and not exists (
        select 1 from notifications n
        where n.type = 'overdue_return' and (n.payload->>'allocation_id')::int = al.id)`);
  if (!rows.length) return 0;
  const { rows: managers } = await query(
    `select id from users where role in ('admin', 'asset_manager') and is_active`);
  for (const al of rows) {
    const payload = { allocation_id: al.id, asset: `${al.name} (${al.tag})`, due: al.expected_return_date };
    for (const uid of new Set([al.holder_id, ...managers.map(m => m.id)]))
      await notify(uid, 'overdue_return', payload);
  }
  return rows.length;
}

export async function runJobs() {
  const [reminders, overdue] = await Promise.all([bookingReminders(), overdueAlerts()]);
  if (reminders || overdue) console.log(`jobs: ${reminders} booking reminders, ${overdue} overdue alerts`);
}

export function startJobs() {
  runJobs().catch(e => console.error('jobs:', e.message));
  setInterval(() => runJobs().catch(e => console.error('jobs:', e.message)), 5 * 60_000);
}
