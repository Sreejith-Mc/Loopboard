import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../store';

/**
 * A coachmark tour: each step spotlights a real control and puts a small card
 * beside it.
 *
 * The overlay never swallows clicks — only the card itself is interactive — so
 * the app stays fully usable while the tour is up. Clicking the highlighted
 * control both does its normal job and advances the tour, which is the point:
 * you learn by pressing the real button, not by reading about it.
 *
 * Steps whose target isn't on screen are skipped rather than pointing at
 * nothing, so this degrades gracefully as the UI changes.
 */

interface Step {
  /** data-tour value of the element to highlight. */
  target: string;
  title: string;
  body: string;
  /** Preferred side; flips automatically when there is no room. */
  side?: 'right' | 'bottom' | 'left' | 'top';
  /** Lives in the sidebar, which is an off-canvas drawer on small screens. */
  inDrawer?: boolean;
}

const STEPS: Step[] = [
  {
    target: 'boards',
    side: 'right',
    inDrawer: true,
    title: 'All your boards live here',
    body: 'Personal boards are private to you. Team boards appear here too once you join a team.',
  },
  {
    target: 'new-board',
    side: 'bottom',
    title: 'Start something new',
    body: 'One board per project or sprint works well. You pick a name, an icon, and who it belongs to.',
  },
  {
    target: 'teams',
    side: 'right',
    inDrawer: true,
    title: 'Share with a team',
    body:
      'Create a team and you get a six-letter invite code. Everyone who joins sees the same boards, ' +
      'and edits show up within a few seconds without refreshing.',
  },
  {
    target: 'help',
    side: 'right',
    inDrawer: true,
    title: 'Replay this any time',
    body: 'This button brings the walkthrough back whenever you want it.',
  },
  // Last on purpose: clicking this navigates into the board, which ends the
  // tour on a useful action rather than cutting the remaining steps short.
  {
    target: 'board-tile',
    side: 'bottom',
    title: 'Now open a board',
    body:
      'Each board has three columns — Up Next, In Flow, Done. Drag cards between them; ' +
      'on a phone, press and hold briefly first. Click the board to dive in.',
  },
];

const PAD = 8;
const CARD_W = 310;
const GAP = 14;

interface Box { top: number; left: number; width: number; height: number }

function measure(target: string): Box | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  // An element inside a closed drawer is translated off-screen; spotlighting
  // it would draw a ring nobody can see.
  if (r.right <= 0 || r.bottom <= 0 || r.left >= window.innerWidth || r.top >= window.innerHeight) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export default function Tour() {
  const { tourOpen, setTourOpen, setMenuOpen } = useStore();
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [narrow, setNarrow] = useState(() => window.innerWidth < 720);

  const step = STEPS[i];

  const close = useCallback(() => {
    setTourOpen(false);
    setI(0);
  }, [setTourOpen]);

  /**
   * Move to the next usable step, or finish. A sidebar step counts as usable
   * on a narrow screen even though it measures as absent right now, because
   * the drawer is about to be opened for it.
   */
  const advance = useCallback((from: number) => {
    const isNarrow = window.innerWidth < 720;
    for (let n = from + 1; n < STEPS.length; n++) {
      if (measure(STEPS[n].target) || (isNarrow && STEPS[n].inDrawer)) {
        setI(n);
        return;
      }
    }
    close();
  }, [close]);

  // Track the target's position through scrolling, resizing and layout shifts.
  useLayoutEffect(() => {
    if (!tourOpen || !step) return;
    const sync = () => {
      setNarrow(window.innerWidth < 720);
      setBox(measure(step.target));
    };
    sync();
    const id = window.setInterval(sync, 250); // cheap, and survives animated layout
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
    };
  }, [tourOpen, step, i]);

  // Clicking the highlighted control advances the tour as well as doing its job.
  useEffect(() => {
    if (!tourOpen || !step) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) return;
    const onClick = () => window.setTimeout(() => advance(i), 260);
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [tourOpen, step, i, advance]);

  // Escape closes, arrows move.
  useEffect(() => {
    if (!tourOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') advance(i);
      if (e.key === 'ArrowLeft' && i > 0) setI(i - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tourOpen, i, advance, close]);

  // On a phone the sidebar is a drawer, so open it for the steps that point
  // into it and close it again for the rest — the highlight follows the tour
  // instead of the user having to find the control themselves.
  useEffect(() => {
    if (!tourOpen || !step || !narrow) return;
    setMenuOpen(!!step.inDrawer);
  }, [tourOpen, step, narrow, setMenuOpen]);

  // Leaving the tour should not leave the drawer hanging open.
  useEffect(() => {
    if (!tourOpen) setMenuOpen(false);
  }, [tourOpen, setMenuOpen]);

  // If a step's target simply isn't there (e.g. no boards yet), jump ahead.
  // Drawer steps on narrow screens are exempt: they are legitimately absent
  // for the moment it takes the drawer to slide open.
  useEffect(() => {
    if (!tourOpen || !step) return;
    if (narrow && step.inDrawer) return;
    if (!measure(step.target)) advance(i);
  }, [tourOpen, step, i, advance, narrow]);

  if (!tourOpen || !step) return null;

  const last = i === STEPS.length - 1;

  // Place the card: preferred side first, then whichever direction has room.
  let cardStyle: React.CSSProperties;
  if (narrow || !box) {
    cardStyle = { left: 12, right: 12, bottom: 12, width: 'auto' };
  } else {
    const side = step.side ?? 'bottom';
    const fitsRight = box.left + box.width + GAP + CARD_W < window.innerWidth;
    const fitsBelow = box.top + box.height + GAP + 190 < window.innerHeight;
    const useSide = side === 'right' && fitsRight ? 'right' : fitsBelow ? 'bottom' : 'top';

    if (useSide === 'right') {
      cardStyle = {
        left: box.left + box.width + GAP,
        top: Math.min(Math.max(12, box.top - 8), window.innerHeight - 210),
        width: CARD_W,
      };
    } else if (useSide === 'bottom') {
      cardStyle = {
        left: Math.min(Math.max(12, box.left), window.innerWidth - CARD_W - 12),
        top: box.top + box.height + GAP,
        width: CARD_W,
      };
    } else {
      cardStyle = {
        left: Math.min(Math.max(12, box.left), window.innerWidth - CARD_W - 12),
        bottom: window.innerHeight - box.top + GAP,
        width: CARD_W,
      };
    }
  }

  return createPortal(
    <div className="tour-layer">
      {box && (
        <motion.div
          className="tour-spot"
          initial={false}
          animate={{
            top: box.top - PAD,
            left: box.left - PAD,
            width: box.width + PAD * 2,
            height: box.height + PAD * 2,
          }}
          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          className="tour-card"
          style={cardStyle}
          initial={{ opacity: 0, scale: 0.97, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="tour-step-n">Step {i + 1} of {STEPS.length}</div>
          <h4>{step.title}</h4>
          <p>{step.body}</p>
          <div className="tour-card-foot">
            <div className="tour-dots">
              {STEPS.map((s, n) => (
                <span key={s.target} className={`tour-dot${n === i ? ' on' : ''}`} />
              ))}
            </div>
            <button className="btn btn-ghost tour-skip" onClick={close}>
              {last ? 'Done' : 'Skip'}
            </button>
            {!last && (
              <button className="btn btn-primary tour-next" onClick={() => advance(i)}>
                Next
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}
