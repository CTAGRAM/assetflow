import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL = '12h';

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, department_id: u.department_id });
const sign = (user) => jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });

export const router = Router();

// Signup always creates an employee. Roles are granted later by an admin
// from the employee directory, never self-assigned here.
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body ?? {};
  const errors = {};
  if (!name?.trim()) errors.name = 'Name is required.';
  if (!EMAIL.test(email ?? '')) errors.email = 'Enter a valid email address, like priya@company.com.';
  if ((password ?? '').length < 8) errors.password = 'Password must be at least 8 characters.';
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows: [user] } = await query(
      `insert into users (name, email, password_hash)
       values ($1, lower($2), $3)
       returning id, name, email, role, department_id`,
      [name.trim(), email, hash],
    );
    res.status(201).json({ token: sign(user), user: publicUser(user) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ errors: { email: 'An account with this email already exists.' } });
    throw e;
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!EMAIL.test(email ?? '')) return res.status(400).json({ errors: { email: 'Enter a valid email address.' } });
  if (!password) return res.status(400).json({ errors: { password: 'Password is required.' } });

  const { rows: [user] } = await query('select * from users where lower(email) = lower($1)', [email]);
  // same message for wrong email and wrong password, no account probing
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    return res.status(401).json({ error: 'Invalid email or password.' });
  if (!user.is_active) return res.status(403).json({ error: 'This account has been deactivated. Contact your admin.' });

  res.json({ token: sign(user), user: publicUser(user) });
});

export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (!token) return res.status(401).json({ error: 'Sign in required.' });
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
  }
  // fetched fresh so a promotion or deactivation applies immediately
  const { rows: [user] } = await query(
    'select id, name, email, role, department_id, is_active from users where id = $1',
    [payload.sub],
  );
  if (!user || !user.is_active) return res.status(401).json({ error: 'This account is no longer active.' });
  req.user = user;
  next();
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ error: 'You do not have permission to do this.' });

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));
