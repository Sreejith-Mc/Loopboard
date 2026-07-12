import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../store';
import type { Card } from '../types';
import { ACCENTS, ACCENT_NAMES, BOARD_EMOJIS } from '../utils';
import Avatar from './Avatar';
import Modal from './Modal';
import ColumnView from './ColumnView';
import { CardBody } from './CardItem';
import CardModal from './CardModal';
import ThemeToggle from './ThemeToggle';

const CONFETTI_COLORS = ['#5b8def', '#2fbf94', '#f2a54a', '#9b7cf2', '#ef7ba4', '#43b7d8'];

interface Burst {
  id: number;
  x: number;
  y: number;
}

function ConfettiBurst({ burst }: { burst: Burst }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        angle: (i / 14) * Math.PI * 2 + Math.random() * 0.5,
        dist: 46 + Math.random() * 46,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        spin: Math.random() * 360 - 180,
        delay: Math.random() * 0.06,
      })),
    [],
  );
  return (
    <div className="confetti-burst" style={{ left: burst.x, top: burst.y }}>
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          style={{ background: p.color }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
          animate={{
            x: Math.cos(p.angle) * p.dist,
            y: Math.sin(p.angle) * p.dist + 26,
            opacity: 0,
            scale: 0.4,
            rotate: p.spin,
          }}
          transition={{ duration: 0.75, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const { board, teams } = useStore();
  const team = teams.find((t) => t.id === board?.teamId);
  if (!board) return null;
  return (
    <Modal onClose={onClose}>
      <h3>Board members</h3>
      {team && (
        <>
          <p style={{ color: 'var(--ink-soft)', fontSize: 13.5, marginTop: -8 }}>
            Anyone who joins <b>{team.name}</b> with this code sees this board and edits it live.
          </p>
          <div className="invite-code">
            <span className="code">{team.inviteCode}</span>
            <button
              className="btn btn-subtle"
              onClick={() => {
                void navigator.clipboard.writeText(team.inviteCode);
                useStore.getState().toast('Invite code copied', 'success');
              }}
            >
              Copy
            </button>
          </div>
        </>
      )}
      <div>
        {board.members.map((m) => (
          <div className="member-row" key={m.id}>
            <Avatar name={m.name} color={m.avatarColor} />
            <div className="who">
              <div className="n">{m.name}</div>
              <div className="e">{m.email}</div>
            </div>
            <span className="role">{m.role}</span>
          </div>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

function AddColumnModal({ onClose }: { onClose: () => void }) {
  const { addColumn } = useStore();
  const [name, setName] = useState('');
  const [accent, setAccent] = useState(ACCENT_NAMES[0]);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    await addColumn(name.trim(), accent, null);
    onClose();
  }

  return (
    <Modal onClose={onClose}>
      <h3>New column</h3>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="field">
          <label>Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Review" autoFocus />
        </div>
        <div className="field">
          <label>Accent</label>
          <div className="accent-row">
            {ACCENT_NAMES.map((a) => (
              <button type="button" key={a} className={a === accent ? 'on' : ''} style={{ background: ACCENTS[a].dot }} onClick={() => setAccent(a)} />
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim() || busy}>
            Add column
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BoardMenu({ onClose, onDelete }: { onClose: () => void; onDelete: () => void }) {
  const { board, renameBoard } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  if (!board) return null;
  return (
    <motion.div
      ref={ref}
      className="pop-menu"
      style={{ right: 0, top: '110%' }}
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
    >
      <div className="field">
        <label>Icon</label>
        <div className="emoji-row">
          {BOARD_EMOJIS.map((e) => (
            <button key={e} className={e === board.emoji ? 'on' : ''} onClick={() => void renameBoard(board.name, e)} style={{ width: 32, height: 32, fontSize: 16 }}>
              {e}
            </button>
          ))}
        </div>
      </div>
      <button className="btn btn-danger" style={{ justifyContent: 'flex-start', padding: '8px 10px', fontSize: 13 }} onClick={onDelete}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        </svg>
        Delete board
      </button>
    </motion.div>
  );
}

type QuickFilter = 'all' | 'mine' | 'due';

export default function BoardView() {
  const { board, user, closeBoard, renameBoard, deleteBoard, moveCardLocal, commitCardMove, openCardId, setOpenCard, setQuickAddColumn } = useStore();
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<QuickFilter>('all');
  const [invite, setInvite] = useState(false);
  const [addCol, setAddCol] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState(board?.name ?? '');
  const [bursts, setBursts] = useState<Burst[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Board-level shortcuts: "/" focuses the filter, "n" starts a card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
      if (typing || useStore.getState().paletteOpen || useStore.getState().openCardId) return;
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key.toLowerCase() === 'n') {
        const first = useStore.getState().board?.columns[0];
        if (first) {
          e.preventDefault();
          setQuickAddColumn(first.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, Card[]>();
    if (!board) return map;
    for (const col of board.columns) map.set(col.id, []);
    const q = search.trim().toLowerCase();
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const soon = new Date(today.getTime() + 2 * 86_400_000);
    for (const card of [...board.cards].sort((a, b) => a.position - b.position)) {
      if (q && !card.title.toLowerCase().includes(q) && !card.labels.some((l) => l.toLowerCase().includes(q))) continue;
      if (filter === 'mine' && card.assigneeId !== user?.id) continue;
      if (filter === 'due' && (!card.dueDate || new Date(card.dueDate + 'T00:00:00') > soon)) continue;
      map.get(card.columnId)?.push(card);
    }
    return map;
  }, [board, search, filter, user]);

  const progress = useMemo(() => {
    if (!board || board.columns.length === 0) return { done: 0, total: 0 };
    const lastCol = board.columns[board.columns.length - 1].id;
    return { done: board.cards.filter((c) => c.columnId === lastCol).length, total: board.cards.length };
  }, [board]);

  if (!board) return null;

  function celebrate(columnId: string) {
    const el = document.querySelector(`[data-col-id="${columnId}"] .column-header`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const id = Date.now();
    setBursts((b) => [...b, { id, x: r.left + r.width / 2, y: r.top + r.height / 2 }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1000);
  }

  function resolveColumnId(overId: string | number): string | null {
    if (!board) return null;
    if (board.columns.some((c) => c.id === overId)) return overId as string;
    const overCard = board.cards.find((c) => c.id === overId);
    return overCard ? overCard.columnId : null;
  }

  function onDragStart({ active }: DragStartEvent) {
    setActiveCard(board!.cards.find((c) => c.id === active.id) ?? null);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || !board) return;
    const card = board.cards.find((c) => c.id === active.id);
    const overColId = resolveColumnId(over.id);
    if (!card || !overColId || card.columnId === overColId) return;
    // Card dragged over another column: move it there optimistically so the
    // preview reflows. Final position is committed on drop.
    const targetCards = board.cards.filter((c) => c.columnId === overColId).sort((a, b) => a.position - b.position);
    const overIndex = targetCards.findIndex((c) => c.id === over.id);
    moveCardLocal(card.id, overColId, overIndex === -1 ? targetCards.length : overIndex);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveCard(null);
    if (!board) return;
    const card = board.cards.find((c) => c.id === active.id);
    if (!card) return;
    let columnId = card.columnId;
    let index = card.position;
    if (over) {
      const overColId = resolveColumnId(over.id);
      if (overColId) {
        columnId = overColId;
        const colCards = board.cards.filter((c) => c.columnId === overColId).sort((a, b) => a.position - b.position);
        if (over.id === overColId) {
          index = colCards.filter((c) => c.id !== card.id).length;
        } else {
          const i = colCards.findIndex((c) => c.id === over.id);
          index = i === -1 ? colCards.length : i;
        }
      }
    }
    // Landing in the last column means "done" — a small celebration is due.
    const lastCol = board.columns[board.columns.length - 1];
    if (lastCol && columnId === lastCol.id && activeCard && activeCard.columnId !== lastCol.id) {
      celebrate(columnId);
    }
    void commitCardMove(card.id, columnId, index);
  }

  const openCardData = openCardId ? board.cards.find((c) => c.id === openCardId) : null;

  return (
    <div className="board-page">
      <header className="board-topbar">
        <button className="btn-icon" title="Back to boards" onClick={closeBoard}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="board-title">
          <span className="emoji">{board.emoji}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={() => setTitle(board.name)}
            onBlur={() => {
              if (title.trim() && title.trim() !== board.name) void renameBoard(title.trim(), board.emoji);
              else setTitle(board.name);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            size={Math.max(board.name.length, 4)}
          />
        </div>

        {progress.total > 0 && (
          <div className="board-progress" title={`${progress.done} of ${progress.total} cards done`}>
            <div className="progress">
              <motion.div initial={false} animate={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} transition={{ type: 'spring', stiffness: 160, damping: 26 }} style={{ height: '100%' }} />
            </div>
            {progress.done}/{progress.total}
          </div>
        )}

        <div className="topbar-right">
          <div className="filter-chips">
            {(
              [
                ['all', 'All'],
                ['mine', 'Mine'],
                ['due', 'Due soon'],
              ] as [QuickFilter, string][]
            ).map(([value, label]) => (
              <button key={value} className={filter === value ? 'on' : ''} onClick={() => setFilter(value)}>
                {label}
              </button>
            ))}
          </div>
          <button className="avatar-stack" onClick={() => setInvite(true)} title="Members" style={{ padding: 0 }}>
            {board.members.slice(0, 4).map((m) => (
              <Avatar key={m.id} name={m.name} color={m.avatarColor} />
            ))}
            {board.members.length > 4 && (
              <span className="avatar" style={{ background: 'var(--ink-mute)' }}>
                +{board.members.length - 4}
              </span>
            )}
          </button>
          {board.teamId && (
            <button className="btn btn-subtle" onClick={() => setInvite(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M19 8v6M22 11h-6" />
              </svg>
              Invite
            </button>
          )}
          <div className="search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter cards…  ( / )" />
            {search && (
              <button className="btn-icon" style={{ padding: 2 }} onClick={() => setSearch('')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <ThemeToggle />
          <div style={{ position: 'relative' }}>
            <button className="btn-icon" onClick={() => setMenu(!menu)} title="Board options">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            </button>
            <AnimatePresence>
              {menu && (
                <BoardMenu
                  onClose={() => setMenu(false)}
                  onDelete={() => {
                    setMenu(false);
                    setConfirmDelete(true);
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveCard(null)}>
        <div className="board-scroll" onMouseDown={() => menu && setMenu(false)}>
          {board.columns.map((col) => (
            <ColumnView key={col.id} column={col} cards={cardsByColumn.get(col.id) ?? []} members={board.members} onOpenCard={(c) => setOpenCard(c.id)} dragActive={!!activeCard} />
          ))}
          <button className="add-column-btn" onClick={() => setAddCol(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add column
          </button>
        </div>
        <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
          {activeCard && (
            <div className="card-item overlay" style={{ width: 268 }}>
              <CardBody card={activeCard} members={board.members} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {bursts.map((b) => (
        <ConfettiBurst key={b.id} burst={b} />
      ))}

      <AnimatePresence>
        {openCardData && <CardModal key="card" card={openCardData} onClose={() => setOpenCard(null)} />}
        {invite && <InviteModal key="invite" onClose={() => setInvite(false)} />}
        {addCol && <AddColumnModal key="addcol" onClose={() => setAddCol(false)} />}
        {confirmDelete && (
          <Modal key="confirm" onClose={() => setConfirmDelete(false)}>
            <h3>Delete “{board.name}”?</h3>
            <p style={{ color: 'var(--ink-soft)', fontSize: 13.5 }}>
              This permanently removes the board and its {board.cards.length} card{board.cards.length === 1 ? '' : 's'} for everyone. There’s no undo.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ background: 'linear-gradient(180deg, #ec5f63, #e5484d)', boxShadow: '0 1px 2px rgba(197,42,47,.35)' }}
                onClick={() => void deleteBoard(board.id)}
              >
                Delete board
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
