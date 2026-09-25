import { FormEvent, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../store';
import { ApiError } from '../api';
import { BOARD_EMOJIS, timeAgo } from '../utils';
import Avatar from './Avatar';
import Modal from './Modal';
import ThemeToggle from './ThemeToggle';
import AdminPanel from './AdminPanel';
import { BoardTilesSkeleton } from './Skeletons';
import type { BoardSummary, Team } from '../types';

function NewBoardModal({ teamId, onClose }: { teamId: string | null; onClose: () => void }) {
  const { createBoard, openBoard, teams } = useStore();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(BOARD_EMOJIS[0]);
  const [team, setTeam] = useState<string | ''>(teamId ?? '');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const id = await createBoard(name.trim(), emoji, team || null);
      onClose();
      await openBoard(id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3>New board</h3>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="field">
          <label>Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 24 · Website refresh" autoFocus />
        </div>
        <div className="field">
          <label>Icon</label>
          <div className="emoji-row">
            {BOARD_EMOJIS.map((e) => (
              <button type="button" key={e} className={e === emoji ? 'on' : ''} onClick={() => setEmoji(e)}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Belongs to</label>
          <select className="input" value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">Personal — just me</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim() || busy}>
            Create board
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TeamModal({ onClose }: { onClose: () => void }) {
  const { createTeam, joinTeam } = useStore();
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Team | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (tab === 'create') {
        const team = await createTeam(name.trim());
        setCreated(team);
      } else {
        await joinTeam(code.trim());
        onClose();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <Modal onClose={onClose}>
        <h3>🎉 {created.name} is ready</h3>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13.5 }}>
          Share this invite code with your teammates. They can join from the sidebar with <b>Join a team</b>.
        </p>
        <div className="invite-code">
          <span className="code">{created.inviteCode}</span>
          <button
            className="btn btn-subtle"
            onClick={() => {
              void navigator.clipboard.writeText(created.inviteCode);
              useStore.getState().toast('Invite code copied', 'success');
            }}
          >
            Copy
          </button>
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      <h3>Teams</h3>
      <div className="seg">
        <button className={tab === 'create' ? 'on' : ''} onClick={() => setTab('create')}>
          Create a team
        </button>
        <button className={tab === 'join' ? 'on' : ''} onClick={() => setTab('join')}>
          Join with a code
        </button>
      </div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <div className="form-error">{error}</div>}
        {tab === 'create' ? (
          <div className="field">
            <label>Team name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Design Guild" autoFocus />
          </div>
        ) : (
          <div className="field">
            <label>Invite code</label>
            <input
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="6-letter code, e.g. K7MPQ2"
              maxLength={6}
              style={{ letterSpacing: '0.2em', fontWeight: 700, textTransform: 'uppercase' }}
              autoFocus
            />
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || (tab === 'create' ? !name.trim() : code.trim().length < 6)}>
            {tab === 'create' ? 'Create team' : 'Join team'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Line icons in one stroke style, so the sidebar and cards read as a set. */
const ICONS = {
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  users: 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M9.5 9a2.5 2.5 0 1 1 3.2 2.4c-.6.2-.9.7-.9 1.3v.6M12 17h.01',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.3-4.3',
  plus: 'M12 5v14M5 12h14',
  menu: 'M4 7h16M4 12h16M4 17h16',
  flow: 'M3 12h4l3-8 4 16 3-8h4',
  check: 'M20 6 9 17l-5-5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2',
} as const;

function Icon({ name, size = 18 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

/**
 * Four headline numbers for whatever the dashboard is scoped to. Every
 * sub-line is derived from real data: there is no history table, so there is
 * no "up 12% from last month" — a trend we can't measure isn't shown.
 */
function StatCards({ boards }: { boards: BoardSummary[] }) {
  const sum = (k: 'cardCount' | 'doneCount' | 'todoCount' | 'dueSoonCount' | 'overdueCount') =>
    boards.reduce((n, b) => n + (b[k] ?? 0), 0);
  const cards = sum('cardCount');
  const done = sum('doneCount');
  // Clamped: on a one-column board the first and last column are the same one.
  const inProgress = Math.max(0, cards - done - sum('todoCount'));
  const dueSoon = sum('dueSoonCount');
  const overdue = sum('overdueCount');
  const pctDone = cards ? Math.round((done / cards) * 100) : 0;

  const items: { label: string; value: number; note: string; icon: keyof typeof ICONS; tone?: 'hero' | 'warn' }[] = [
    { label: 'Total boards', value: boards.length, note: `${cards} card${cards === 1 ? '' : 's'} across them`, icon: 'grid', tone: 'hero' },
    { label: 'In progress', value: inProgress, note: 'Cards between the first and last column', icon: 'flow' },
    { label: 'Done', value: done, note: cards ? `${pctDone}% of all cards` : 'Nothing finished yet', icon: 'check' },
    { label: 'Due soon', value: dueSoon, note: overdue ? `${overdue} overdue` : 'Nothing overdue', icon: 'clock', tone: overdue ? 'warn' : undefined },
  ];

  return (
    <div className="stats">
      {items.map((s, i) => (
        <motion.div
          key={s.label}
          className={`stat-card${s.tone ? ` ${s.tone}` : ''}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="stat-top">
            <span className="stat-label">{s.label}</span>
            <span className="stat-icon"><Icon name={s.icon} size={16} /></span>
          </div>
          <div className="stat-value">{s.value}</div>
          <div className="stat-note">{s.note}</div>
        </motion.div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user, teams, boards, openBoard, logout, setTourOpen, menuOpen, setMenuOpen, workspaceLoading, setPaletteOpen } = useStore();
  const [scope, setScope] = useState<'all' | 'personal' | string>('all');
  const [newBoard, setNewBoard] = useState(false);
  const [teamModal, setTeamModal] = useState(false);

  const visible = useMemo(() => {
    if (scope === 'all') return boards;
    if (scope === 'personal') return boards.filter((b) => !b.teamId);
    return boards.filter((b) => b.teamId === scope);
  }, [boards, scope]);

  // After logout this component briefly re-renders while exit-animating with
  // user already null — bail out (after all hooks) instead of crashing blank.
  if (!user) return null;

  const scopeTeam = teams.find((t) => t.id === scope);
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="dash">
      {menuOpen && <div className="drawer-backdrop" onClick={() => setMenuOpen(false)} />}

      <aside className={`sidebar${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)}>
        <span className="logo">
          <span className="logo-mark">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="4" width="5" height="16" rx="2.5" fill="#fff" />
              <rect x="14" y="4" width="5" height="10" rx="2.5" fill="#fff" opacity="0.85" />
            </svg>
          </span>
          Loopboard
        </span>

        <div className="side-label">Menu</div>
        <button data-tour="boards" className={`side-item ${scope === 'all' ? 'active' : ''}`} onClick={() => setScope('all')}>
          <Icon name="grid" /> All boards
          <span className="count">{boards.length}</span>
        </button>
        <button className={`side-item ${scope === 'personal' ? 'active' : ''}`} onClick={() => setScope('personal')}>
          <Icon name="lock" /> Personal
          <span className="count">{boards.filter((b) => !b.teamId).length}</span>
        </button>

        <div className="side-label side-label-action" data-tour="teams">
          Teams
          <button className="btn-icon" title="Create or join a team" onClick={() => setTeamModal(true)}>
            <Icon name="plus" size={14} />
          </button>
        </div>
        {teams.length === 0 && (
          <button className="side-item muted" onClick={() => setTeamModal(true)}>
            <Icon name="users" /> Create or join a team
          </button>
        )}
        {teams.map((t) => (
          <button key={t.id} className={`side-item ${scope === t.id ? 'active' : ''}`} onClick={() => setScope(t.id)}>
            <Icon name="users" /> {t.name}
            <span className="count">{t.memberCount}</span>
          </button>
        ))}

        <div className="side-label">General</div>
        <button data-tour="help" className="side-item" onClick={() => setTourOpen(true)}>
          <Icon name="help" /> How it works
        </button>
        <button className="side-item" onClick={() => void logout()}>
          <Icon name="logout" /> Log out
        </button>

        <AdminPanel />
      </aside>

      <main className="dash-main">
        <header className="topbar">
          <button className="btn-icon topbar-menu" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <Icon name="menu" />
          </button>
          {/* The palette already searches boards and cards; this is its front door. */}
          <button className="search-trigger" onClick={() => setPaletteOpen(true)}>
            <Icon name="search" size={16} />
            <span>Search boards and cards</span>
            <kbd>Ctrl K</kbd>
          </button>
          <div className="topbar-actions">
            <ThemeToggle />
            <div className="topbar-user">
              <Avatar name={user!.name} color={user!.avatarColor} />
              <div className="who">
                <div className="n">{user!.name}</div>
                <div className="e">{user!.email}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="page-head">
          <div>
            <h1>{scopeTeam ? scopeTeam.name : scope === 'personal' ? 'Personal boards' : 'Dashboard'}</h1>
            <div className="sub">
              {scopeTeam
                ? `Invite code ${scopeTeam.inviteCode} · ${scopeTeam.memberCount} member${scopeTeam.memberCount === 1 ? '' : 's'}`
                : `${greeting}, ${user!.name.split(' ')[0]}. Here's where your work stands.`}
            </div>
          </div>
          <div className="page-actions">
            <button data-tour="new-board" className="btn btn-primary btn-pill" onClick={() => setNewBoard(true)}>
              <Icon name="plus" size={15} />
              New board
            </button>
            <button className="btn btn-outline btn-pill" onClick={() => setTeamModal(true)}>
              Add team
            </button>
          </div>
        </div>

        {!workspaceLoading && <StatCards boards={visible} />}

        <div className="section-head">
          <h2>Boards</h2>
          <span>{visible.length} board{visible.length === 1 ? '' : 's'}</span>
        </div>

        {workspaceLoading ? (
          <BoardTilesSkeleton />
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <div className="big">🌤️</div>
            <h3>Nothing here yet</h3>
            <p>Create a board and give your work some room to breathe.</p>
          </div>
        ) : (
          <motion.div className="boards-grid" layout>
            <AnimatePresence>
              {visible.map((b, i) => {
                const team = teams.find((t) => t.id === b.teamId);
                const pct = b.cardCount ? Math.round((b.doneCount / b.cardCount) * 100) : 0;
                return (
                  <motion.button
                    key={b.id}
                    className="board-tile"
                    data-tour={i === 0 ? 'board-tile' : undefined}
                    layout
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] }}
                    onClick={() => void openBoard(b.id)}
                  >
                    <span className="emoji">{b.emoji}</span>
                    <div>
                      <div className="t">{b.name}</div>
                      <div className="m">
                        {team ? `👥 ${team.name}` : 'Personal'} · {b.cardCount} card{b.cardCount === 1 ? '' : 's'} · {timeAgo(b.updatedAt)}
                      </div>
                    </div>
                    <div className="progress">
                      <div style={{ width: `${pct}%` }} />
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
            <motion.button layout className="board-tile-new" onClick={() => setNewBoard(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New board
            </motion.button>
          </motion.div>
        )}
      </main>

      <AnimatePresence>
        {newBoard && <NewBoardModal key="nb" teamId={scopeTeam?.id ?? null} onClose={() => setNewBoard(false)} />}
        {teamModal && <TeamModal key="tm" onClose={() => setTeamModal(false)} />}
      </AnimatePresence>
    </div>
  );
}
