import express from 'express';
import { query } from './db.js';

const app = express();
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  await query('select 1');
  res.json({ status: 'ok' });
});

// route modules mount here as they land:
// app.use('/api/auth', authRoutes);
// app.use('/api/assets', assetRoutes);
// app.use('/api/bookings', bookingRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side.' });
});

const port = process.env.PORT ?? 3000;
app.listen(port, () => console.log(`AssetFlow API on :${port}`));
