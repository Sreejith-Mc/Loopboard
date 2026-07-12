import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useStore } from '../store';

interface Item {
  key: string;
  group: string;
  icon: string;
  label: string;
  sub?: string;
  run: () => void;
}

/** Rank: exact prefix beats word-prefix beats substring. -1 = no match. */
function score(text: string, q: string): number {
  const t = text.toLowerCase();
  if (t.startsWith(q)) return 3;
  if (t.split(/\s+/).some((w) => w.startsWith(q))) return 2;
  if (t.includes(q)) return 1;
  return -1;
}

export default function CommandPalette() {
  const { boards, board, teams, theme, setTheme, openBoard, closeBoard, setOpenCard, setPaletteOpen } = useStore();
  const [query, setQuery] = useState('');
  const [hl, setHl] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = () => setPaletteOpen(false);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    if (board) {
      for (const card of board.cards) {
        out.push({
          key: `card-${card.id}`,
          group: 'Cards on this board',
          icon: '🗒️',
          label: card.title,
          sub: board.columns.find((c) => c.id === card.columnId)?.name,
          run: () => {
            setOpenCard(card.id);
            close();
          },
        });
      }
    }
    for (const b of boards) {
      if (b.id === board?.id) continue;
      out.push({
        key: `board-${b.id}`,
        group: 'Jump to board',
        icon: b.emoji,
        label: b.name,
        sub: b.teamId ? teams.find((t) => t.id === b.teamId)?.name : 'Personal',
        run: () => {
          close();
          void openBoard(b.id);
        },
      });
    }
    out.push({
      key: 'act-theme',
      group: 'Actions',
      icon: theme === 'dark' ? '☀️' : '🌙',
      label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
      run: () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
        close();
      },
    });
    if (board) {
      out.push({
        key: 'act-dash',
        group: 'Actions',
        icon: '🏠',
        label: 'Back to all boards',
        run: () => {
          close();
          closeBoard();
        },
      });
    }
    return out;
  }, [boards, board, teams, theme]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Default view: boards + actions (skip the long card list until typed).
      return items.filter((i) => i.group !== 'Cards on this board').slice(0, 9);
    }
    return items
      .map((i) => ({ i, s: score(i.label, q) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.i)
      .slice(0, 12);
  }, [items, query]);

  useEffect(() => setHl(0), [query]);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    listRef.current?.querySelector('.palette-item.hl')?.scrollIntoView({ block: 'nearest' });
  }, [hl]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHl((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHl((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      results[hl]?.run();
    } else if (e.key === 'Escape') {
      close();
    }
  }

  let lastGroup = '';

  return createPortal(
    <motion.div
      className="palette-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <motion.div
        className="palette"
        initial={{ opacity: 0, scale: 0.96, y: -12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: -8 }}
        transition={{ type: 'spring', stiffness: 480, damping: 34 }}
        onKeyDown={onKey}
      >
        <div className="palette-input">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search cards, boards, actions…" />
        </div>
        <div className="palette-list" ref={listRef}>
          {results.length === 0 && <div className="palette-empty">Nothing matches “{query}”</div>}
          {results.map((item, idx) => {
            const showGroup = item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <div key={item.key}>
                {showGroup && <div className="palette-group">{item.group}</div>}
                <button className={`palette-item${idx === hl ? ' hl' : ''}`} onMouseEnter={() => setHl(idx)} onClick={item.run}>
                  <span className="ico">{item.icon}</span>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                  {item.sub && <span className="sub">{item.sub}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette-foot">
          <span>
            <kbd>↑↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> select
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
