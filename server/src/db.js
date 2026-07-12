import pg from 'pg';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export const query = (text, params) => pool.query(text, params);

// run fn inside one transaction; fn gets a client, use client.query throughout
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}

export const logActivity = (actorId, action, entity, entityId, details = {}) =>
  query('insert into activity_log (actor_id, action, entity, entity_id, details) values ($1, $2, $3, $4, $5)',
    [actorId, action, entity, entityId, details]);

export const notify = (userId, type, payload = {}) =>
  query('insert into notifications (user_id, type, payload) values ($1, $2, $3)', [userId, type, payload]);
