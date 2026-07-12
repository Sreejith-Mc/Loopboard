import { CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card, Member } from '../types';
import { formatDue, labelColor } from '../utils';
import Avatar from './Avatar';

export function CardBody({ card, members }: { card: Card; members: Member[] }) {
  const assignee = card.assigneeId ? members.find((m) => m.id === card.assigneeId) : null;
  const due = card.dueDate ? formatDue(card.dueDate) : null;
  const showFoot = card.priority !== 'none' || due || assignee;
  return (
    <>
      {card.labels.length > 0 && (
        <div className="card-meta">
          {card.labels.map((l) => {
            const c = labelColor(l);
            return (
              <span key={l} className="chip" style={{ background: c.bg, color: c.text }}>
                {l}
              </span>
            );
          })}
        </div>
      )}
      <div className="card-title">{card.title}</div>
      {showFoot && (
        <div className="card-foot">
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            {card.priority !== 'none' && <span className={`priority-pill pr-${card.priority}`}>{card.priority}</span>}
            {due && (
              <span className={`due ${due.state === 'ok' ? '' : due.state}`}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                {due.text}
              </span>
            )}
          </span>
          {assignee && <Avatar name={assignee.name} color={assignee.avatarColor} small />}
        </div>
      )}
    </>
  );
}

export default function CardItem({
  card,
  members,
  onOpen,
}: {
  card: Card;
  members: Member[];
  onOpen: (card: Card) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', columnId: card.columnId },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card-item${isDragging ? ' ghost' : ''}`}
      onClick={() => onOpen(card)}
      {...attributes}
      {...listeners}
    >
      <CardBody card={card} members={members} />
    </div>
  );
}
