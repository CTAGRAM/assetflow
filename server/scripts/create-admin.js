// Bootstrap or reset the admin account. Signup can only create employees,
// so the first admin comes from here:
//   npm run create-admin -- "Full Name" admin@company.com password123
import bcrypt from 'bcrypt';
import { pool } from '../src/db.js';

const [name, email, password] = process.argv.slice(2);
if (!name || !email || (password ?? '').length < 8) {
  console.error('usage: npm run create-admin -- "Full Name" email password (8+ chars)');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
const { rows: [user] } = await pool.query(
  `insert into users (name, email, password_hash, role)
   values ($1, lower($2), $3, 'admin')
   on conflict (lower(email)) do update set role = 'admin', password_hash = excluded.password_hash
   returning id, email`,
  [name, email, hash],
);
console.log(`admin ready: ${user.email} (id ${user.id})`);
await pool.end();
