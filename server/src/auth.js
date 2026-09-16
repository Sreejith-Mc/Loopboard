import crypto from 'node:crypto';
import { q, one } from './db.js';

const SESSION_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days
const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(candidate, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  await q(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)',
    [token, userId, now, now + SESSION_TTL],
  );
  return token;
}

export async function destroySession(token) {
  await q('DELETE FROM sessions WHERE token = $1', [token]);
}

export function setSessionCookie(res, token) {
  res.cookie('lb_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    // Required for the cookie to be stored over HTTPS on Vercel.
    secure: isProd,
    maxAge: SESSION_TTL,
    path: '/',
  });
}

/** Express middleware: attaches req.user or 401s. */
export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.lb_session;
    if (!token) return res.status(401).json({ error: 'Not signed in' });
    const row = await one(
      `SELECT u.id, u.name, u.email, u.avatar_color AS "avatarColor", s.expires_at AS "expiresAt"
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = $1`,
      [token],
    );
    if (!row || Number(row.expiresAt) < Date.now()) {
      if (row) await destroySession(token);
      return res.status(401).json({ error: 'Session expired' });
    }
    req.user = { id: row.id, name: row.name, email: row.email, avatarColor: row.avatarColor };
    req.sessionToken = token;
    next();
  } catch (err) {
    next(err);
  }
}

export const AVATAR_COLORS = ['#5B8DEF', '#34C99A', '#F2A54A', '#9B7CF2', '#EF7BA4', '#4AC1E0'];
export function pickAvatarColor(seed) {
  let sum = 0;
  for (const ch of seed) sum += ch.charCodeAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}
