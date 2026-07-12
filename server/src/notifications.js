import { Router } from 'express';
import { query } from './db.js';
import { requireAuth } from './auth.js';
import { idParam } from './org.js';

export const router = Router();
router.use(requireAuth);

router.get('/notifications', async (req, res) => {
  const { rows } = await query(
    `select * from notifications where user_id = $1 order by created_at desc limit 50`, [req.user.id]);
  const { rows: [{ unread }] } = await query(
    `select count(*)::int as unread from notifications where user_id = $1 and read_at is null`, [req.user.id]);
  res.json({ unread, notifications: rows });
});

router.post('/notifications/:id/read', async (req, res) => {
  const id = idParam(req, res);
  if (!id) return;
  const { rows: [n] } = await query(
    `update notifications set read_at = now() where id = $1 and user_id = $2 returning *`, [id, req.user.id]);
  if (!n) return res.status(404).json({ error: 'Notification not found.' });
  res.json(n);
});

router.post('/notifications/read-all', async (req, res) => {
  await query(`update notifications set read_at = now() where user_id = $1 and read_at is null`, [req.user.id]);
  res.json({ ok: true });
});

// managers see the whole trail; employees see their own actions
router.get('/activity', async (req, res) => {
  const { entity, user_id, from, to } = req.query;
  const canSeeAll = ['admin', 'asset_manager', 'department_head'].includes(req.user.role);
  const { rows } = await query(
    `select l.*, u.name as actor_name
     from activity_log l left join users u on u.id = l.actor_id
     where ($1::int is null or l.actor_id = $1)
       and ($2::text is null or l.entity = $2)
       and ($3::timestamptz is null or l.created_at >= $3)
       and ($4::timestamptz is null or l.created_at <= $4)
     order by l.created_at desc limit 200`,
    [canSeeAll ? (user_id || null) : req.user.id, entity || null, from || null, to || null]);
  res.json(rows);
});
