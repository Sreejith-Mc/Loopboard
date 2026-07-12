import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import {
  hashPassword, verifyPassword, createSession, destroySession,
  setSessionCookie, requireAuth, pickAvatarColor,
} from './auth.js';
import { subscribe, broadcast } from './live.js';

const app = express();
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.API_PORT || 8787;
const uid = () => crypto.randomUUID();
const now = () => Date.now();

// ---------- helpers ----------

function inviteCode() {
  // Short, human-friendly, unambiguous alphabet.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[crypto.randomInt(alphabet.length)];
  return code;
}

function isTeamMember(teamId, userId) {
  return !!db.prepare('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?').get(teamId, userId);
}

function getBoardIfAllowed(boardId, userId) {
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId);
  if (!board) return null;
  if (board.team_id) return isTeamMember(board.team_id, userId) ? board : null;
  return board.owner_id === userId ? board : null;
}

function touchBoard(boardId) {
  db.prepare('UPDATE boards SET updated_at = ? WHERE id = ?').run(now(), boardId);
}

function renumberColumn(columnId) {
  const rows = db.prepare('SELECT id FROM cards WHERE column_id = ? ORDER BY position').all(columnId);
  const upd = db.prepare('UPDATE cards SET position = ? WHERE id = ?');
  rows.forEach((r, i) => upd.run(i, r.id));
}

function boardPayload(board) {
  const columns = db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY position').all(board.id)
    .map((c) => ({ id: c.id, name: c.name, accent: c.accent, position: c.position, wipLimit: c.wip_limit }));
  const cards = db.prepare('SELECT * FROM cards WHERE board_id = ? ORDER BY position').all(board.id)
    .map((c) => ({
      id: c.id, columnId: c.column_id, title: c.title, description: c.description,
      priority: c.priority, labels: JSON.parse(c.labels), assigneeId: c.assignee_id,
      dueDate: c.due_date, position: c.position, createdBy: c.created_by,
      createdAt: c.created_at, updatedAt: c.updated_at,
    }));
  let members;
  if (board.team_id) {
    members = db.prepare(`
      SELECT u.id, u.name, u.email, u.avatar_color AS avatarColor, tm.role
      FROM team_members tm JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = ? ORDER BY tm.joined_at
    `).all(board.team_id);
  } else {
    members = db.prepare('SELECT id, name, email, avatar_color AS avatarColor FROM users WHERE id = ?')
      .all(board.owner_id).map((u) => ({ ...u, role: 'owner' }));
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

function createBoardWithDefaults({ name, emoji, teamId, ownerId }) {
  const boardId = uid();
  const ts = now();
  db.prepare('INSERT INTO boards (id, name, emoji, team_id, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(boardId, name, emoji || '🌀', teamId || null, ownerId, ts, ts);
  const insCol = db.prepare('INSERT INTO columns (id, board_id, name, accent, position, wip_limit) VALUES (?, ?, ?, ?, ?, ?)');
  const colIds = DEFAULT_COLUMNS.map((c, i) => {
    const id = uid();
    insCol.run(id, boardId, c.name, c.accent, i, c.wipLimit ?? null);
    return id;
  });
  return { boardId, colIds };
}

function seedWelcomeBoard(userId) {
  const { boardId, colIds } = createBoardWithDefaults({ name: 'Welcome to Loopboard', emoji: '👋', ownerId: userId });
  const ins = db.prepare(`INSERT INTO cards
    (id, board_id, column_id, title, description, priority, labels, position, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const ts = now();
  const samples = [
    [colIds[0], 'Drag me to "In Flow" →', 'Cards glide between columns. Grab anywhere on the card and drop it where it belongs.', 'medium', ['tip'], 0],
    [colIds[0], 'Click a card to open details', 'Set priority, labels, a due date and an assignee — everything autosaves to the cloud.', 'none', ['tip'], 1],
    [colIds[1], 'Respect the flow limit', '"In Flow" has a WIP limit of 3. The column glows amber when your team takes on too much at once.', 'high', ['flow'], 0],
    [colIds[2], 'Create a team from the sidebar', 'Share the 6-letter invite code and teammates see changes live — no refresh needed.', 'none', ['teams'], 0],
  ];
  for (const [colId, title, desc, priority, labels, pos] of samples) {
    ins.run(uid(), boardId, colId, title, desc, priority, JSON.stringify(labels), pos, userId, ts, ts);
  }
}

// ---------- auth ----------

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const normEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) return res.status(400).json({ error: 'That email doesn’t look right' });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(normEmail)) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }
  const id = uid();
  db.prepare('INSERT INTO users (id, name, email, password_hash, avatar_color, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, name.trim(), normEmail, hashPassword(password), pickAvatarColor(normEmail), now());
  seedWelcomeBoard(id);
  setSessionCookie(res, createSession(id));
  const user = db.prepare('SELECT id, name, email, avatar_color AS avatarColor FROM users WHERE id = ?').get(id);
  res.json({ user });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').trim().toLowerCase());
  if (!row || !verifyPassword(password || '', row.password_hash)) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  setSessionCookie(res, createSession(row.id));
  res.json({ user: { id: row.id, name: row.name, email: row.email, avatarColor: row.avatar_color } });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  destroySession(req.sessionToken);
  res.clearCookie('lb_session', { path: '/' });
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ---------- workspace ----------

app.get('/api/workspace', requireAuth, (req, res) => {
  const teams = db.prepare(`
    SELECT t.id, t.name, t.invite_code AS inviteCode, tm.role,
      (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS memberCount
    FROM team_members tm JOIN teams t ON t.id = tm.team_id
    WHERE tm.user_id = ? ORDER BY t.created_at
  `).all(req.user.id);
  const boards = db.prepare(`
    SELECT b.id, b.name, b.emoji, b.team_id AS teamId, b.owner_id AS ownerId, b.updated_at AS updatedAt,
      (SELECT COUNT(*) FROM cards WHERE board_id = b.id) AS cardCount,
      (SELECT COUNT(*) FROM cards c JOIN columns col ON col.id = c.column_id
        WHERE c.board_id = b.id AND col.position = (SELECT MAX(position) FROM columns WHERE board_id = b.id)) AS doneCount
    FROM boards b
    WHERE (b.team_id IS NULL AND b.owner_id = @me)
       OR b.team_id IN (SELECT team_id FROM team_members WHERE user_id = @me)
    ORDER BY b.updated_at DESC
  `).all({ me: req.user.id });
  res.json({ teams, boards });
});

// ---------- teams ----------

app.post('/api/teams', requireAuth, (req, res) => {
  const { name } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Team name is required' });
  const id = uid();
  db.prepare('INSERT INTO teams (id, name, invite_code, created_by, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, name.trim(), inviteCode(), req.user.id, now());
  db.prepare('INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)')
    .run(id, req.user.id, 'owner', now());
  const team = db.prepare('SELECT id, name, invite_code AS inviteCode FROM teams WHERE id = ?').get(id);
  res.json({ team: { ...team, role: 'owner', memberCount: 1 } });
});

app.post('/api/teams/join', requireAuth, (req, res) => {
  const code = (req.body?.code || '').trim().toUpperCase();
  const team = db.prepare('SELECT * FROM teams WHERE invite_code = ?').get(code);
  if (!team) return res.status(404).json({ error: 'No team found with that invite code' });
  if (isTeamMember(team.id, req.user.id)) return res.status(409).json({ error: 'You’re already in this team' });
  db.prepare('INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)')
    .run(team.id, req.user.id, 'member', now());
  res.json({ team: { id: team.id, name: team.name, inviteCode: team.invite_code, role: 'member' } });
});

app.get('/api/teams/:id/members', requireAuth, (req, res) => {
  if (!isTeamMember(req.params.id, req.user.id)) return res.status(403).json({ error: 'Not your team' });
  const members = db.prepare(`
    SELECT u.id, u.name, u.email, u.avatar_color AS avatarColor, tm.role
    FROM team_members tm JOIN users u ON u.id = tm.user_id
    WHERE tm.team_id = ? ORDER BY tm.joined_at
  `).all(req.params.id);
  res.json({ members });
});

app.post('/api/teams/:id/leave', requireAuth, (req, res) => {
  if (!isTeamMember(req.params.id, req.user.id)) return res.status(403).json({ error: 'Not your team' });
  db.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?').run(req.params.id, req.user.id);
  const remaining = db.prepare('SELECT COUNT(*) AS n FROM team_members WHERE team_id = ?').get(req.params.id).n;
  if (remaining === 0) db.prepare('DELETE FROM teams WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- boards ----------

app.post('/api/boards', requireAuth, (req, res) => {
  const { name, emoji, teamId } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Board name is required' });
  if (teamId && !isTeamMember(teamId, req.user.id)) return res.status(403).json({ error: 'Not your team' });
  const { boardId } = createBoardWithDefaults({ name: name.trim(), emoji, teamId, ownerId: req.user.id });
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId);
  res.json({ board: boardPayload(board) });
});

app.get('/api/boards/:id', requireAuth, (req, res) => {
  const board = getBoardIfAllowed(req.params.id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  res.json({ board: boardPayload(board) });
});

app.patch('/api/boards/:id', requireAuth, (req, res) => {
  const board = getBoardIfAllowed(req.params.id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  const { name, emoji } = req.body || {};
  db.prepare('UPDATE boards SET name = ?, emoji = ?, updated_at = ? WHERE id = ?')
    .run(name?.trim() || board.name, emoji || board.emoji, now(), board.id);
  broadcast(board.id, req.headers['x-client-id']);
  res.json({ ok: true });
});

app.delete('/api/boards/:id', requireAuth, (req, res) => {
  const board = getBoardIfAllowed(req.params.id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  db.prepare('DELETE FROM boards WHERE id = ?').run(board.id);
  broadcast(board.id, req.headers['x-client-id']);
  res.json({ ok: true });
});

// ---------- columns ----------

app.post('/api/boards/:id/columns', requireAuth, (req, res) => {
  const board = getBoardIfAllowed(req.params.id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  const { name, accent, wipLimit } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Column name is required' });
  const pos = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM columns WHERE board_id = ?').get(board.id).p;
  const id = uid();
  db.prepare('INSERT INTO columns (id, board_id, name, accent, position, wip_limit) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, board.id, name.trim(), accent || 'blue', pos, wipLimit ?? null);
  touchBoard(board.id);
  broadcast(board.id, req.headers['x-client-id']);
  res.json({ column: { id, name: name.trim(), accent: accent || 'blue', position: pos, wipLimit: wipLimit ?? null } });
});

app.patch('/api/columns/:id', requireAuth, (req, res) => {
  const col = db.prepare('SELECT * FROM columns WHERE id = ?').get(req.params.id);
  const board = col && getBoardIfAllowed(col.board_id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Column not found' });
  const { name, accent, wipLimit } = req.body || {};
  db.prepare('UPDATE columns SET name = ?, accent = ?, wip_limit = ? WHERE id = ?')
    .run(name?.trim() || col.name, accent || col.accent, wipLimit === undefined ? col.wip_limit : wipLimit, col.id);
  touchBoard(board.id);
  broadcast(board.id, req.headers['x-client-id']);
  res.json({ ok: true });
});

app.delete('/api/columns/:id', requireAuth, (req, res) => {
  const col = db.prepare('SELECT * FROM columns WHERE id = ?').get(req.params.id);
  const board = col && getBoardIfAllowed(col.board_id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Column not found' });
  db.prepare('DELETE FROM columns WHERE id = ?').run(col.id);
  touchBoard(board.id);
  broadcast(board.id, req.headers['x-client-id']);
  res.json({ ok: true });
});

// ---------- cards ----------

app.post('/api/columns/:id/cards', requireAuth, (req, res) => {
  const col = db.prepare('SELECT * FROM columns WHERE id = ?').get(req.params.id);
  const board = col && getBoardIfAllowed(col.board_id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Column not found' });
  const { title, description, priority, labels, assigneeId, dueDate } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: 'Card title is required' });
  const pos = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM cards WHERE column_id = ?').get(col.id).p;
  const id = uid();
  const ts = now();
  db.prepare(`INSERT INTO cards
    (id, board_id, column_id, title, description, priority, labels, assignee_id, due_date, position, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, board.id, col.id, title.trim(), description || '', priority || 'none',
      JSON.stringify(labels || []), assigneeId || null, dueDate || null, pos, req.user.id, ts, ts);
  touchBoard(board.id);
  broadcast(board.id, req.headers['x-client-id']);
  res.json({ cardId: id });
});

app.patch('/api/cards/:id', requireAuth, (req, res) => {
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  const board = card && getBoardIfAllowed(card.board_id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Card not found' });
  const b = req.body || {};
  db.prepare(`UPDATE cards SET title = ?, description = ?, priority = ?, labels = ?,
    assignee_id = ?, due_date = ?, updated_at = ? WHERE id = ?`)
    .run(
      b.title !== undefined ? String(b.title).trim() || card.title : card.title,
      b.description !== undefined ? b.description : card.description,
      b.priority !== undefined ? b.priority : card.priority,
      b.labels !== undefined ? JSON.stringify(b.labels) : card.labels,
      b.assigneeId !== undefined ? b.assigneeId : card.assignee_id,
      b.dueDate !== undefined ? b.dueDate : card.due_date,
      now(), card.id,
    );
  touchBoard(board.id);
  broadcast(board.id, req.headers['x-client-id']);
  res.json({ ok: true });
});

app.post('/api/cards/:id/move', requireAuth, (req, res) => {
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  const board = card && getBoardIfAllowed(card.board_id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Card not found' });
  const { columnId, index } = req.body || {};
  const target = db.prepare('SELECT * FROM columns WHERE id = ? AND board_id = ?').get(columnId, board.id);
  if (!target) return res.status(400).json({ error: 'Target column not found' });

  db.transaction(() => {
    // Lift the card out, then insert at the requested index.
    db.prepare('UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ?')
      .run(card.column_id, card.position);
    db.prepare('UPDATE cards SET position = position + 1 WHERE column_id = ? AND position >= ? AND id != ?')
      .run(target.id, index, card.id);
    db.prepare('UPDATE cards SET column_id = ?, position = ?, updated_at = ? WHERE id = ?')
      .run(target.id, index, now(), card.id);
    renumberColumn(card.column_id);
    if (target.id !== card.column_id) renumberColumn(target.id);
  })();

  touchBoard(board.id);
  broadcast(board.id, req.headers['x-client-id']);
  res.json({ ok: true });
});

app.delete('/api/cards/:id', requireAuth, (req, res) => {
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  const board = card && getBoardIfAllowed(card.board_id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Card not found' });
  db.prepare('DELETE FROM cards WHERE id = ?').run(card.id);
  renumberColumn(card.column_id);
  touchBoard(board.id);
  broadcast(board.id, req.headers['x-client-id']);
  res.json({ ok: true });
});

// ---------- live events ----------

app.get('/api/boards/:id/events', requireAuth, (req, res) => {
  const board = getBoardIfAllowed(req.params.id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(':ok\n\n');
  const ping = setInterval(() => res.write(':ping\n\n'), 25_000);
  res.on('close', () => clearInterval(ping));
  subscribe(board.id, res);
});

// In production (`npm start` after `npm run build`), serve the built client too.
const clientDist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`Loopboard API listening on http://localhost:${PORT}`);
});
