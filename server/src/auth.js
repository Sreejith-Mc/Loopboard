import crypto from 'node:crypto';
import { db } from './db.js';

const SESSION_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(token, userId, now, now + SESSION_TTL);
  return token;
}

export function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function setSessionCookie(res, token) {
  res.cookie('lb_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_TTL,
    path: '/',
  });
}

/** Express middleware: attaches req.user or 401s. */
export function requireAuth(req, res, next) {
  const token = req.cookies?.lb_session;
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  const row = db.prepare(`
    SELECT u.id, u.name, u.email, u.avatar_color AS avatarColor, s.expires_at AS expiresAt
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `).get(token);
  if (!row || row.expiresAt < Date.now()) {
    if (row) destroySession(token);
    return res.status(401).json({ error: 'Session expired' });
  }
  req.user = { id: row.id, name: row.name, email: row.email, avatarColor: row.avatarColor };
  req.sessionToken = token;
  next();
}

export const AVATAR_COLORS = ['#5B8DEF', '#34C99A', '#F2A54A', '#9B7CF2', '#EF7BA4', '#4AC1E0'];
export function pickAvatarColor(seed) {
  let sum = 0;
  for (const ch of seed) sum += ch.charCodeAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}
