import express from 'express';
import { query } from './db.js';
import { router as authRouter } from './auth.js';
import { router as orgRouter } from './org.js';
import { router as assetsRouter } from './assets.js';
import { router as allocationsRouter } from './allocations.js';
import { router as bookingsRouter } from './bookings.js';

const app = express();
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  await query('select 1');
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api', orgRouter);          // /departments /categories /employees
app.use('/api/assets', assetsRouter);
app.use('/api', allocationsRouter);  // /allocations /transfers
app.use('/api/bookings', bookingsRouter);

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side.' });
});

const port = process.env.PORT ?? 3000;
app.listen(port, () => console.log(`AssetFlow API on :${port}`));
