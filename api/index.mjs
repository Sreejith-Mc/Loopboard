// Vercel serverless entrypoint. An Express app is itself an (req, res) handler,
// so Vercel can invoke it directly. vercel.json rewrites every /api/* request
// here, and the app's own routes keep their /api prefix.
import app from '../server/src/app.js';

export default app;
