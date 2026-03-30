import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');
const port = Number(process.env.PORT ?? 3000);
const apiBaseUrl = process.env.API_BASE_URL?.trim() || 'http://localhost:4000';

const app = express();

app.get('/config.js', (_req, res) => {
  res.type('application/javascript').send(
    `window.__APP_CONFIG__ = ${JSON.stringify({
      apiBaseUrl
    })};`
  );
});

app.use(express.static(publicDir));

app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`Web app listening on http://localhost:${port}`);
});
