import { Router } from 'express';
import { query, logActivity } from './db.js';
import { requireAuth, requireRole } from './auth.js';

const ROLES = ['admin', 'asset_manager', 'department_head', 'employee'];

export const router = Router();
router.use(requireAuth);

export function idParam(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'Invalid id in URL.' });
    return null;
  }
  return id;
}

// ---- departments ----

router.get('/departments', async (_req, res) => {
  const { rows } = await query(
    `select d.*, h.name as head_name, p.name as parent_name,
            (select count(*) from users u where u.department_id = d.id and u.is_active) as member_count
     from departments d
     left join users h on h.id = d.head_id
     left join departments p on p.id = d.parent_id
     order by d.name`);
  res.json(rows);
});

router.post('/departments', requireRole('admin'), async (req, res) => {
  const { name, parent_id, head_id } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ errors: { name: 'Department name is required.' } });
  try {
    const { rows: [dep] } = await query(
      'insert into departments (name, parent_id, head_id) values ($1, $2, $3) returning *',
      [name.trim(), parent_id ?? null, head_id ?? null]);
    await logActivity(req.user.id, 'created', 'department', dep.id, { name: dep.name });
    res.status(201).json(dep);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ errors: { name: 'A department with this name already exists.' } });
    if (e.code === '23503') return res.status(400).json({ error: 'The selected head or parent department does not exist.' });
    throw e;
  }
});

router.patch('/departments/:id', requireRole('admin'), async (req, res) => {
  const id = idParam(req, res);
  if (!id) return;
  const allowed = ['name', 'parent_id', 'head_id', 'is_active'];
  const fields = allowed.filter(f => f in (req.body ?? {}));
  if (!fields.length) return res.status(400).json({ error: 'Nothing to update.' });
  if (req.body.parent_id === id) return res.status(400).json({ error: 'A department cannot be its own parent.' });
  if ('name' in req.body && !req.body.name?.trim()) return res.status(400).json({ errors: { name: 'Department name cannot be empty.' } });
  try {
    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const { rows: [dep] } = await query(
      `update departments set ${sets} where id = $1 returning *`,
      [id, ...fields.map(f => f === 'name' ? req.body[f].trim() : req.body[f])]);
    if (!dep) return res.status(404).json({ error: 'Department not found.' });
    await logActivity(req.user.id, 'updated', 'department', id, req.body);
    res.json(dep);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ errors: { name: 'A department with this name already exists.' } });
    if (e.code === '23503') return res.status(400).json({ error: 'The selected head or parent department does not exist.' });
    throw e;
  }
});

// ---- asset categories ----

router.get('/categories', async (_req, res) => {
  const { rows } = await query(
    `select c.*, (select count(*) from assets a where a.category_id = c.id) as asset_count
     from asset_categories c order by c.name`);
  res.json(rows);
});

router.post('/categories', requireRole('admin'), async (req, res) => {
  const { name, extra_fields } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ errors: { name: 'Category name is required.' } });
  if (extra_fields !== undefined && !Array.isArray(extra_fields))
    return res.status(400).json({ errors: { extra_fields: 'Extra fields must be a list, like [{"name": "warranty_months", "type": "number"}].' } });
  try {
    const { rows: [cat] } = await query(
      'insert into asset_categories (name, extra_fields) values ($1, $2) returning *',
      [name.trim(), JSON.stringify(extra_fields ?? [])]);
    await logActivity(req.user.id, 'created', 'category', cat.id, { name: cat.name });
    res.status(201).json(cat);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ errors: { name: 'A category with this name already exists.' } });
    throw e;
  }
});

router.patch('/categories/:id', requireRole('admin'), async (req, res) => {
  const id = idParam(req, res);
  if (!id) return;
  const { name, extra_fields, is_active } = req.body ?? {};
  if (name !== undefined && !name?.trim()) return res.status(400).json({ errors: { name: 'Category name cannot be empty.' } });
  if (extra_fields !== undefined && !Array.isArray(extra_fields))
    return res.status(400).json({ errors: { extra_fields: 'Extra fields must be a list.' } });
  try {
    const { rows: [cat] } = await query(
      `update asset_categories set
         name = coalesce($2, name),
         extra_fields = coalesce($3, extra_fields),
         is_active = coalesce($4, is_active)
       where id = $1 returning *`,
      [id, name?.trim(), extra_fields ? JSON.stringify(extra_fields) : null, is_active]);
    if (!cat) return res.status(404).json({ error: 'Category not found.' });
    await logActivity(req.user.id, 'updated', 'category', id, req.body);
    res.json(cat);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ errors: { name: 'A category with this name already exists.' } });
    throw e;
  }
});

// ---- employee directory ----

router.get('/employees', async (req, res) => {
  const search = req.query.search?.trim();
  const { rows } = await query(
    `select u.id, u.name, u.email, u.role, u.department_id, u.is_active, u.created_at, d.name as department_name
     from users u left join departments d on d.id = u.department_id
     where ($1::text is null or u.name ilike '%' || $1 || '%' or u.email ilike '%' || $1 || '%')
     order by u.name`,
    [search || null]);
  res.json(rows);
});

// the only place a role is granted: admin promotes from the directory
router.patch('/employees/:id', requireRole('admin'), async (req, res) => {
  const id = idParam(req, res);
  if (!id) return;
  const { role, department_id, is_active } = req.body ?? {};
  if (role !== undefined && !ROLES.includes(role))
    return res.status(400).json({ errors: { role: `Role must be one of: ${ROLES.join(', ')}.` } });
  if (id === req.user.id && (role !== undefined || is_active === false))
    return res.status(400).json({ error: 'You cannot change your own role or deactivate yourself.' });
  try {
    const { rows: [user] } = await query(
      `update users set
         role = coalesce($2, role),
         department_id = coalesce($3, department_id),
         is_active = coalesce($4, is_active)
       where id = $1 returning id, name, email, role, department_id, is_active`,
      [id, role, department_id, is_active]);
    if (!user) return res.status(404).json({ error: 'Employee not found.' });
    await logActivity(req.user.id, 'updated', 'employee', id, req.body);
    res.json(user);
  } catch (e) {
    if (e.code === '23503') return res.status(400).json({ error: 'The selected department does not exist.' });
    throw e;
  }
});
