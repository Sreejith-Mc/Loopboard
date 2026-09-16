// Local dev / self-hosted entrypoint: loads .env, then listens on a port.
// On Vercel the app is exported as a serverless function from api/index.mjs
// instead, and this file is never executed.
import './load-env.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import app from './app.js';

const PORT = process.env.API_PORT || 8787;

// After `npm run build`, one process can serve the API and the built client.
const clientDist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`Loopboard API listening on http://localhost:${PORT}`);
});
