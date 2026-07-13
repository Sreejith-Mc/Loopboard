import { FormEvent, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../store';
import { ApiError } from '../api';
import { BOARD_EMOJIS, timeAgo } from '../utils';
import Avatar from './Avatar';
import Modal from './Modal';
import ThemeToggle from './ThemeToggle';
import type { Team } from '../types';

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

export default function Dashboard() {
  const { user, teams, boards, openBoard, logout } = useStore();
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
      <aside className="sidebar">
        <span className="logo">
          <span className="logo-mark">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="4" width="5" height="16" rx="2.5" fill="#fff" />
              <rect x="14" y="4" width="5" height="10" rx="2.5" fill="#fff" opacity="0.85" />
            </svg>
          </span>
          Loopboard
        </span>

        <button className={`side-item ${scope === 'all' ? 'active' : ''}`} onClick={() => setScope('all')}>
          <span>🗂️</span> All boards
          <span className="count">{boards.length}</span>
        </button>
        <button className={`side-item ${scope === 'personal' ? 'active' : ''}`} onClick={() => setScope('personal')}>
          <span>🔒</span> Personal
          <span className="count">{boards.filter((b) => !b.teamId).length}</span>
        </button>

        <div className="side-section">
          Teams
          <button className="btn-icon" title="Create or join a team" onClick={() => setTeamModal(true)} style={{ padding: 3 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        {teams.length === 0 && (
          <button className="side-item" onClick={() => setTeamModal(true)} style={{ color: 'var(--ink-mute)' }}>
            <span>✨</span> Create or join a team
          </button>
        )}
        {teams.map((t) => (
          <button key={t.id} className={`side-item ${scope === t.id ? 'active' : ''}`} onClick={() => setScope(t.id)}>
            <span>👥</span> {t.name}
            <span className="count">{t.memberCount}</span>
          </button>
        ))}

        <div className="side-footer">
          <Avatar name={user!.name} color={user!.avatarColor} />
          <div className="who">
            <div className="n">{user!.name}</div>
            <div className="e">{user!.email}</div>
          </div>
          <ThemeToggle />
          <button className="btn-icon" title="Sign out" onClick={() => void logout()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </aside>

      <main className="dash-main">
        <div className="dash-head">
          <div>
            <h1>
              {scopeTeam ? scopeTeam.name : scope === 'personal' ? 'Personal boards' : `${greeting}, ${user!.name.split(' ')[0]}`}
            </h1>
            <div className="sub">
              {scopeTeam
                ? `Invite code ${scopeTeam.inviteCode} · ${scopeTeam.memberCount} member${scopeTeam.memberCount === 1 ? '' : 's'}`
                : visible.length === 0
                  ? 'Calm boards, clear heads.'
                  : `${visible.length} board${visible.length === 1 ? '' : 's'} in flow`}
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setNewBoard(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New board
          </button>
        </div>

        {visible.length === 0 ? (
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
