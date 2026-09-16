import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import { q, one, tx } from './db.js';
import {
  hashPassword, verifyPassword, createSession, destroySession,
  setSessionCookie, requireAuth, pickAvatarColor,
} from './auth.js';

export const app = express();
app.use(express.json());
app.use(cookieParser());

const uid = () => crypto.randomUUID();
const now = () => Date.now();

/** Wrap an async route so rejected promises reach the error handler. */
const a = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Query helpers that optionally run on a transaction client. */
const rows = async (ex, text, params) => (ex ? (await ex.query(text, params)).rows : q(text, params));
const row = async (ex, text, params) => (await rows(ex, text, params))[0] ?? null;

// ---------- helpers ----------

function inviteCode() {
  // Short, human-friendly, unambiguous alphabet.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[crypto.randomInt(alphabet.length)];
  return code;
}

async function isTeamMember(teamId, userId, ex) {
  return !!(await row(ex, 'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]));
}

async function getBoardIfAllowed(boardId, userId, ex) {
  const board = await row(ex, 'SELECT * FROM boards WHERE id = $1', [boardId]);
  if (!board) return null;
  if (board.team_id) return (await isTeamMember(board.team_id, userId, ex)) ? board : null;
  return board.owner_id === userId ? board : null;
}

async function touchBoard(boardId, ex) {
  await rows(ex, 'UPDATE boards SET updated_at = $1 WHERE id = $2', [now(), boardId]);
}

async function renumberColumn(columnId, ex) {
  const list = await rows(ex, 'SELECT id FROM cards WHERE column_id = $1 ORDER BY position', [columnId]);
  for (let i = 0; i < list.length; i++) {
    await rows(ex, 'UPDATE cards SET position = $1 WHERE id = $2', [i, list[i].id]);
  }
}

async function boardPayload(board) {
  const columns = (await q('SELECT * FROM columns WHERE board_id = $1 ORDER BY position', [board.id]))
    .map((c) => ({ id: c.id, name: c.name, accent: c.accent, position: c.position, wipLimit: c.wip_limit }));
  const cards = (await q('SELECT * FROM cards WHERE board_id = $1 ORDER BY position', [board.id]))
    .map((c) => ({
      id: c.id, columnId: c.column_id, title: c.title, description: c.description,
      priority: c.priority, labels: JSON.parse(c.labels), assigneeId: c.assignee_id,
      dueDate: c.due_date, position: c.position, createdBy: c.created_by,
      createdAt: c.created_at, updatedAt: c.updated_at,
    }));
  let members;
  if (board.team_id) {
    members = await q(
      `SELECT u.id, u.name, u.email, u.avatar_color AS "avatarColor", tm.role
       FROM team_members tm JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1 ORDER BY tm.joined_at`,
      [board.team_id],
    );
  } else {
    members = (await q(
      'SELECT id, name, email, avatar_color AS "avatarColor" FROM users WHERE id = $1',
      [board.owner_id],
    )).map((u) => ({ ...u, role: 'owner' }));
  }
  return {
    id: board.id, name: board.name, emoji: board.emoji, teamId: board.team_id,
    ownerId: board.owner_id, updatedAt: board.updated_at,
    columns, cards, members,
  };
}

const DEFAULT_COLUMNS = [
  { name: 'Up Next', accent: 'blue' },
  { name: 'In Flow', accent: 'violet', wipLimit: 3 },
  { name: 'Done', accent: 'green' },
];

async function createBoardWithDefaults({ name, emoji, teamId, ownerId }, ex) {
  const boardId = uid();
  const ts = now();
  await rows(ex,
    'INSERT INTO boards (id, name, emoji, team_id, owner_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [boardId, name, emoji || '🌀', teamId || null, ownerId, ts, ts]);
  const colIds = [];
  for (let i = 0; i < DEFAULT_COLUMNS.length; i++) {
    const c = DEFAULT_COLUMNS[i];
    const id = uid();
    await rows(ex,
      'INSERT INTO columns (id, board_id, name, accent, position, wip_limit) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, boardId, c.name, c.accent, i, c.wipLimit ?? null]);
    colIds.push(id);
  }
  return { boardId, colIds };
}

async function seedWelcomeBoard(userId, ex) {
  const { boardId, colIds } = await createBoardWithDefaults(
    { name: 'Welcome to Loopboard', emoji: '👋', ownerId: userId }, ex);
  const ts = now();
  const samples = [
    [colIds[0], 'Drag me to "In Flow" →', 'Cards glide between columns. Grab anywhere on the card and drop it where it belongs.', 'medium', ['tip'], 0],
    [colIds[0], 'Click a card to open details', 'Set priority, labels, a due date and an assignee — everything autosaves to the cloud.', 'none', ['tip'], 1],
    [colIds[1], 'Respect the flow limit', '"In Flow" has a WIP limit of 3. The column glows amber when your team takes on too much at once.', 'high', ['flow'], 0],
    [colIds[2], 'Create a team from the sidebar', 'Share the 6-letter invite code and teammates see changes live — no refresh needed.', 'none', ['teams'], 0],
  ];
  for (const [colId, title, desc, priority, labels, pos] of samples) {
    await rows(ex,
      `INSERT INTO cards
       (id, board_id, column_id, title, description, priority, labels, position, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [uid(), boardId, colId, title, desc, priority, JSON.stringify(labels), pos, userId, ts, ts]);
  }
}

// ---------- auth ----------

app.post('/api/auth/register', a(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const normEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) return res.status(400).json({ error: 'That email doesn’t look right' });
  if (await one('SELECT 1 FROM users WHERE email = $1', [normEmail])) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }
  const id = uid();
  // One transaction: a half-seeded account is worse than a failed signup.
  await tx(async (client) => {
    await client.query(
      'INSERT INTO users (id, name, email, password_hash, avatar_color, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, name.trim(), normEmail, hashPassword(password), pickAvatarColor(normEmail), now()]);
    await seedWelcomeBoard(id, client);
  });
  setSessionCookie(res, await createSession(id));
  const user = await one('SELECT id, name, email, avatar_color AS "avatarColor" FROM users WHERE id = $1', [id]);
  res.json({ user });
}));

app.post('/api/auth/login', a(async (req, res) => {
  const { email, password } = req.body || {};
  const found = await one('SELECT * FROM users WHERE email = $1', [(email || '').trim().toLowerCase()]);
  if (!found || !verifyPassword(password || '', found.password_hash)) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  setSessionCookie(res, await createSession(found.id));
  res.json({ user: { id: found.id, name: found.name, email: found.email, avatarColor: found.avatar_color } });
}));

app.post('/api/auth/logout', requireAuth, a(async (req, res) => {
  await destroySession(req.sessionToken);
  res.clearCookie('lb_session', { path: '/' });
  res.json({ ok: true });
}));

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ---------- workspace ----------

app.get('/api/workspace', requireAuth, a(async (req, res) => {
  const teams = await q(
    `SELECT t.id, t.name, t.invite_code AS "inviteCode", tm.role,
       (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS "memberCount"
     FROM team_members tm JOIN teams t ON t.id = tm.team_id
     WHERE tm.user_id = $1 ORDER BY t.created_at`,
    [req.user.id]);
  const boards = await q(
    `SELECT b.id, b.name, b.emoji, b.team_id AS "teamId", b.owner_id AS "ownerId", b.updated_at AS "updatedAt",
       (SELECT COUNT(*) FROM cards WHERE board_id = b.id) AS "cardCount",
       (SELECT COUNT(*) FROM cards c JOIN columns col ON col.id = c.column_id
         WHERE c.board_id = b.id AND col.position = (SELECT MAX(position) FROM columns WHERE board_id = b.id)) AS "doneCount"
     FROM boards b
     WHERE (b.team_id IS NULL AND b.owner_id = $1)
        OR b.team_id IN (SELECT team_id FROM team_members WHERE user_id = $1)
     ORDER BY b.updated_at DESC`,
    [req.user.id]);
  res.json({ teams, boards });
}));

// ---------- teams ----------

app.post('/api/teams', requireAuth, a(async (req, res) => {
  const { name } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Team name is required' });
  const id = uid();
  await tx(async (client) => {
    await client.query('INSERT INTO teams (id, name, invite_code, created_by, created_at) VALUES ($1, $2, $3, $4, $5)',
      [id, name.trim(), inviteCode(), req.user.id, now()]);
    await client.query('INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES ($1, $2, $3, $4)',
      [id, req.user.id, 'owner', now()]);
  });
  const team = await one('SELECT id, name, invite_code AS "inviteCode" FROM teams WHERE id = $1', [id]);
  res.json({ team: { ...team, role: 'owner', memberCount: 1 } });
}));

app.post('/api/teams/join', requireAuth, a(async (req, res) => {
  const code = (req.body?.code || '').trim().toUpperCase();
  const team = await one('SELECT * FROM teams WHERE invite_code = $1', [code]);
  if (!team) return res.status(404).json({ error: 'No team found with that invite code' });
  if (await isTeamMember(team.id, req.user.id)) return res.status(409).json({ error: 'You’re already in this team' });
  await q('INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES ($1, $2, $3, $4)',
    [team.id, req.user.id, 'member', now()]);
  res.json({ team: { id: team.id, name: team.name, inviteCode: team.invite_code, role: 'member' } });
}));

app.get('/api/teams/:id/members', requireAuth, a(async (req, res) => {
  if (!await isTeamMember(req.params.id, req.user.id)) return res.status(403).json({ error: 'Not your team' });
  const members = await q(
    `SELECT u.id, u.name, u.email, u.avatar_color AS "avatarColor", tm.role
     FROM team_members tm JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = $1 ORDER BY tm.joined_at`,
    [req.params.id]);
  res.json({ members });
}));

app.post('/api/teams/:id/leave', requireAuth, a(async (req, res) => {
  if (!await isTeamMember(req.params.id, req.user.id)) return res.status(403).json({ error: 'Not your team' });
  await q('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  const remaining = await one('SELECT COUNT(*) AS n FROM team_members WHERE team_id = $1', [req.params.id]);
  if (Number(remaining.n) === 0) await q('DELETE FROM teams WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ---------- boards ----------

app.post('/api/boards', requireAuth, a(async (req, res) => {
  const { name, emoji, teamId } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Board name is required' });
  if (teamId && !await isTeamMember(teamId, req.user.id)) return res.status(403).json({ error: 'Not your team' });
  const { boardId } = await tx((client) =>
    createBoardWithDefaults({ name: name.trim(), emoji, teamId, ownerId: req.user.id }, client));
  const board = await one('SELECT * FROM boards WHERE id = $1', [boardId]);
  res.json({ board: await boardPayload(board) });
}));

app.get('/api/boards/:id', requireAuth, a(async (req, res) => {
  const board = await getBoardIfAllowed(req.params.id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  res.json({ board: await boardPayload(board) });
}));

// Cheap poll target for live sync: clients hold the last updatedAt they saw and
// only refetch the whole board when this changes.
app.get('/api/boards/:id/version', requireAuth, a(async (req, res) => {
  const board = await getBoardIfAllowed(req.params.id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  res.json({ updatedAt: board.updated_at });
}));

app.patch('/api/boards/:id', requireAuth, a(async (req, res) => {
  const board = await getBoardIfAllowed(req.params.id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  const { name, emoji } = req.body || {};
  await q('UPDATE boards SET name = $1, emoji = $2, updated_at = $3 WHERE id = $4',
    [name?.trim() || board.name, emoji || board.emoji, now(), board.id]);
  res.json({ ok: true });
}));

app.delete('/api/boards/:id', requireAuth, a(async (req, res) => {
  const board = await getBoardIfAllowed(req.params.id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  await q('DELETE FROM boards WHERE id = $1', [board.id]);
  res.json({ ok: true });
}));

// ---------- columns ----------

app.post('/api/boards/:id/columns', requireAuth, a(async (req, res) => {
  const board = await getBoardIfAllowed(req.params.id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  const { name, accent, wipLimit } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Column name is required' });
  const { p: pos } = await one('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM columns WHERE board_id = $1', [board.id]);
  const id = uid();
  await q('INSERT INTO columns (id, board_id, name, accent, position, wip_limit) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, board.id, name.trim(), accent || 'blue', pos, wipLimit ?? null]);
  await touchBoard(board.id);
  res.json({ column: { id, name: name.trim(), accent: accent || 'blue', position: pos, wipLimit: wipLimit ?? null } });
}));

app.patch('/api/columns/:id', requireAuth, a(async (req, res) => {
  const col = await one('SELECT * FROM columns WHERE id = $1', [req.params.id]);
  const board = col && await getBoardIfAllowed(col.board_id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Column not found' });
  const { name, accent, wipLimit } = req.body || {};
  await q('UPDATE columns SET name = $1, accent = $2, wip_limit = $3 WHERE id = $4',
    [name?.trim() || col.name, accent || col.accent, wipLimit === undefined ? col.wip_limit : wipLimit, col.id]);
  await touchBoard(board.id);
  res.json({ ok: true });
}));

app.delete('/api/columns/:id', requireAuth, a(async (req, res) => {
  const col = await one('SELECT * FROM columns WHERE id = $1', [req.params.id]);
  const board = col && await getBoardIfAllowed(col.board_id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Column not found' });
  await q('DELETE FROM columns WHERE id = $1', [col.id]);
  await touchBoard(board.id);
  res.json({ ok: true });
}));

// ---------- cards ----------

app.post('/api/columns/:id/cards', requireAuth, a(async (req, res) => {
  const col = await one('SELECT * FROM columns WHERE id = $1', [req.params.id]);
  const board = col && await getBoardIfAllowed(col.board_id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Column not found' });
  const { title, description, priority, labels, assigneeId, dueDate } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: 'Card title is required' });
  const { p: pos } = await one('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM cards WHERE column_id = $1', [col.id]);
  const id = uid();
  const ts = now();
  await q(
    `INSERT INTO cards
     (id, board_id, column_id, title, description, priority, labels, assignee_id, due_date, position, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [id, board.id, col.id, title.trim(), description || '', priority || 'none',
      JSON.stringify(labels || []), assigneeId || null, dueDate || null, pos, req.user.id, ts, ts]);
  await touchBoard(board.id);
  res.json({ cardId: id });
}));

app.patch('/api/cards/:id', requireAuth, a(async (req, res) => {
  const card = await one('SELECT * FROM cards WHERE id = $1', [req.params.id]);
  const board = card && await getBoardIfAllowed(card.board_id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Card not found' });
  const b = req.body || {};
  await q(
    `UPDATE cards SET title = $1, description = $2, priority = $3, labels = $4,
     assignee_id = $5, due_date = $6, updated_at = $7 WHERE id = $8`,
    [
      b.title !== undefined ? String(b.title).trim() || card.title : card.title,
      b.description !== undefined ? b.description : card.description,
      b.priority !== undefined ? b.priority : card.priority,
      b.labels !== undefined ? JSON.stringify(b.labels) : card.labels,
      b.assigneeId !== undefined ? b.assigneeId : card.assignee_id,
      b.dueDate !== undefined ? b.dueDate : card.due_date,
      now(), card.id,
    ]);
  await touchBoard(board.id);
  res.json({ ok: true });
}));

app.post('/api/cards/:id/move', requireAuth, a(async (req, res) => {
  const card = await one('SELECT * FROM cards WHERE id = $1', [req.params.id]);
  const board = card && await getBoardIfAllowed(card.board_id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Card not found' });
  const { columnId, index } = req.body || {};
  const target = await one('SELECT * FROM columns WHERE id = $1 AND board_id = $2', [columnId, board.id]);
  if (!target) return res.status(400).json({ error: 'Target column not found' });
  const at = Number.isInteger(index) ? index : Number.parseInt(index, 10);
  if (!Number.isInteger(at) || at < 0) return res.status(400).json({ error: 'A valid target index is required' });

  await tx(async (client) => {
    // Lift the card out, then insert at the requested index.
    await client.query('UPDATE cards SET position = position - 1 WHERE column_id = $1 AND position > $2',
      [card.column_id, card.position]);
    await client.query('UPDATE cards SET position = position + 1 WHERE column_id = $1 AND position >= $2 AND id != $3',
      [target.id, at, card.id]);
    await client.query('UPDATE cards SET column_id = $1, position = $2, updated_at = $3 WHERE id = $4',
      [target.id, at, now(), card.id]);
    await renumberColumn(card.column_id, client);
    if (target.id !== card.column_id) await renumberColumn(target.id, client);
    await touchBoard(board.id, client);
  });

  res.json({ ok: true });
}));

app.delete('/api/cards/:id', requireAuth, a(async (req, res) => {
  const card = await one('SELECT * FROM cards WHERE id = $1', [req.params.id]);
  const board = card && await getBoardIfAllowed(card.board_id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Card not found' });
  await tx(async (client) => {
    await client.query('DELETE FROM cards WHERE id = $1', [card.id]);
    await renumberColumn(card.column_id, client);
    await touchBoard(board.id, client);
  });
  res.json({ ok: true });
}));

// ---------- errors ----------

// Always answer JSON: the client parses error bodies, and Express's default
// handler would leak an HTML stack trace to the browser.
app.use((err, req, res, _next) => {
  console.error('[loopboard]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Something went wrong on our end' });
});

export default app;
