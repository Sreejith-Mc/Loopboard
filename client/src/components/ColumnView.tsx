import { FormEvent, useEffect, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AnimatePresence, motion } from 'framer-motion';
import type { Card, Column, Member } from '../types';
import { ACCENTS, ACCENT_NAMES } from '../utils';
import { useStore } from '../store';
import CardItem from './CardItem';

function ColumnMenu({ column, onClose }: { column: Column; onClose: () => void }) {
  const { updateColumn, deleteColumn } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const [wip, setWip] = useState(column.wipLimit?.toString() ?? '');

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      className="pop-menu"
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.15 }}
    >
      <div className="field">
        <label>Accent</label>
        <div className="accent-row">
          {ACCENT_NAMES.map((a) => (
            <button
              key={a}
              className={a === column.accent ? 'on' : ''}
              style={{ background: ACCENTS[a].dot }}
              onClick={() => void updateColumn(column.id, { accent: a })}
              title={a}
            />
          ))}
        </div>
      </div>
      <div className="field">
        <label>Flow limit (WIP)</label>
        <input
          className="input"
          type="number"
          min={0}
          placeholder="No limit"
          value={wip}
          onChange={(e) => setWip(e.target.value)}
          onBlur={() => {
            const n = wip === '' ? null : Math.max(0, parseInt(wip, 10) || 0) || null;
            void updateColumn(column.id, { wipLimit: n });
          }}
          style={{ padding: '7px 11px' }}
        />
      </div>
      <button
        className="btn btn-danger"
        style={{ justifyContent: 'flex-start', padding: '8px 10px', fontSize: 13 }}
        onClick={() => {
          onClose();
          void deleteColumn(column.id);
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        </svg>
        Delete column
      </button>
    </motion.div>
  );
}

function QuickAdd({ columnId }: { columnId: string }) {
  const { addCard, quickAddColumnId, setQuickAddColumn } = useStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Opened remotely — e.g. the "n" keyboard shortcut targets this column.
  useEffect(() => {
    if (quickAddColumnId === columnId) {
      setOpen(true);
      setQuickAddColumn(null);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [quickAddColumnId, columnId]);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const t = title.trim();
    if (!t) {
      setOpen(false);
      return;
    }
    setTitle('');
    inputRef.current?.focus();
    await addCard(columnId, t);
  }

  if (!open) {
    return (
      <button className="quick-add-btn" onClick={() => setOpen(true)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add card
      </button>
    );
  }

  return (
    <form className="quick-add-form" onSubmit={submit}>
      <input
        ref={inputRef}
        className="input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs doing?"
        autoFocus
        onBlur={() => {
          if (!title.trim()) setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setTitle('');
            setOpen(false);
          }
        }}
      />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button type="submit" className="btn btn-primary" style={{ padding: '6.5px 13px', fontSize: 12.5 }}>
          Add
        </button>
        <span className="kbd-hint">↵ to add · esc to close</span>
      </div>
    </form>
  );
}

export default function ColumnView({
  column,
  cards,
  members,
  onOpenCard,
  dragActive,
}: {
  column: Column;
  cards: Card[];
  members: Member[];
  onOpenCard: (card: Card) => void;
  dragActive: boolean;
}) {
  const { updateColumn } = useStore();
  const [menu, setMenu] = useState(false);
  const [name, setName] = useState(column.name);
  useEffect(() => setName(column.name), [column.name]);

  const { setNodeRef } = useDroppable({ id: column.id, data: { type: 'column' } });
  const accent = ACCENTS[column.accent] ?? ACCENTS.blue;
  const overLimit = column.wipLimit != null && column.wipLimit > 0 && cards.length > column.wipLimit;

  return (
    <motion.section
      className={`column${overLimit ? ' over-limit' : ''}`}
      data-col-id={column.id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className="column-header" style={{ position: 'relative' }}>
        <span className="col-dot" style={{ background: accent.dot }} />
        <input
          className="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name.trim() !== column.name) void updateColumn(column.id, { name: name.trim() });
            else setName(column.name);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        <motion.span
          key={cards.length}
          initial={{ scale: 1.35 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          className="col-count"
          style={overLimit ? { background: 'var(--amber-soft)', color: '#b97516' } : undefined}
        >
          {cards.length}
        </motion.span>
        {column.wipLimit != null && column.wipLimit > 0 && (
          <span className={`wip-badge${overLimit ? ' hot' : ''}`} title="Flow limit — keep work-in-progress low">
            {overLimit ? '⚠ ' : ''}max {column.wipLimit}
          </span>
        )}
        <button className="btn-icon" style={{ marginLeft: 'auto', padding: 5 }} onClick={() => setMenu(!menu)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        </button>
        <AnimatePresence>{menu && <ColumnMenu column={column} onClose={() => setMenu(false)} />}</AnimatePresence>
      </header>

      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="column-cards">
          {cards.length === 0 && (
            <div className={`drop-hint${dragActive ? ' eager' : ''}`}>{dragActive ? 'Drop it here' : 'Nothing here — enjoy the calm'}</div>
          )}
          {/* No AnimatePresence here: an exit-animating clone would briefly register
              a second sortable with the same id and confuse an in-flight drag. */}
          {cards.map((card) => (
            <motion.div key={card.id} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.16 }}>
              <CardItem card={card} members={members} onOpen={onOpenCard} />
            </motion.div>
          ))}
        </div>
      </SortableContext>

      <footer className="column-footer">
        <QuickAdd columnId={column.id} />
      </footer>
    </motion.section>
  );
}
