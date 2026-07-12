import { useState } from 'react';
import { useStore } from '../store';
import type { Card, Priority } from '../types';
import { PRIORITIES, labelColor, timeAgo } from '../utils';
import Avatar from './Avatar';
import Modal from './Modal';

export default function CardModal({ card, onClose }: { card: Card; onClose: () => void }) {
  const { board, updateCard, deleteCard } = useStore();
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [labelInput, setLabelInput] = useState('');

  if (!board) return null;
  const column = board.columns.find((c) => c.id === card.columnId);
  const creator = board.members.find((m) => m.id === card.createdBy);

  function addLabel() {
    const l = labelInput.trim().toLowerCase();
    setLabelInput('');
    if (!l || card.labels.includes(l)) return;
    void updateCard(card.id, { labels: [...card.labels, l] });
  }

  return (
    <Modal onClose={onClose} wide>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            const t = title.trim();
            if (t && t !== card.title) void updateCard(card.id, { title: t });
            else setTitle(card.title);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          style={{ fontSize: 16.5, fontWeight: 700, border: 'none', boxShadow: 'none', padding: '4px 8px', margin: '-4px -8px', background: 'transparent' }}
        />
        <button className="btn-icon" onClick={onClose} title="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {column && (
        <div style={{ fontSize: 12.5, color: 'var(--ink-mute)', marginTop: -10 }}>
          in <b style={{ color: 'var(--ink-soft)' }}>{column.name}</b>
          {creator && <> · added by {creator.name}</>} · {timeAgo(card.createdAt)}
        </div>
      )}

      <div className="field">
        <label>Description</label>
        <textarea
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => {
            if (description !== card.description) void updateCard(card.id, { description });
          }}
          placeholder="Add a little context — what does done look like?"
        />
      </div>

      <div className="field">
        <label>Priority</label>
        <div className="seg">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              className={card.priority === p.value ? 'on' : ''}
              onClick={() => void updateCard(card.id, { priority: p.value as Priority })}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="field">
          <label>Due date</label>
          <input
            className="input"
            type="date"
            value={card.dueDate ?? ''}
            onChange={(e) => void updateCard(card.id, { dueDate: e.target.value || null })}
          />
        </div>
        <div className="field">
          <label>Assignee</label>
          <select className="input" value={card.assigneeId ?? ''} onChange={(e) => void updateCard(card.id, { assigneeId: e.target.value || null })}>
            <option value="">Unassigned</option>
            {board.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label>Labels</label>
        <div className="label-chips-edit input" style={{ padding: '7px 11px' }}>
          {card.labels.map((l) => {
            const c = labelColor(l);
            return (
              <span key={l} className="chip" style={{ background: c.bg, color: c.text }}>
                {l}
                <button onClick={() => void updateCard(card.id, { labels: card.labels.filter((x) => x !== l) })}>×</button>
              </span>
            );
          })}
          <input
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addLabel();
              }
              if (e.key === 'Backspace' && !labelInput && card.labels.length) {
                void updateCard(card.id, { labels: card.labels.slice(0, -1) });
              }
            }}
            onBlur={addLabel}
            placeholder={card.labels.length ? '' : 'Type a label, press ↵'}
          />
        </div>
      </div>

      {card.assigneeId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--ink-soft)' }}>
          {(() => {
            const a = board.members.find((m) => m.id === card.assigneeId);
            return a ? (
              <>
                <Avatar name={a.name} color={a.avatarColor} small /> Assigned to <b>{a.name}</b>
              </>
            ) : null;
          })()}
        </div>
      )}

      <div className="modal-actions">
        <button
          className="btn btn-danger spacer"
          onClick={() => {
            onClose();
            void deleteCard(card.id);
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
          Delete
        </button>
        <button className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
