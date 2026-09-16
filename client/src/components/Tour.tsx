import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Modal from './Modal';
import { useStore } from '../store';

/**
 * A short, skippable walkthrough. It shows itself once per browser after
 * signing up, and is reachable any time from the "?" button in the sidebar.
 * Deliberately small: five cards, a dot row, and a visible way out at every
 * step — no spotlight overlay chasing the cursor around.
 */

interface Step {
  art: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    art: '🌀',
    title: 'Boards hold the work',
    body:
      'Every board starts with three columns — Up Next, In Flow, Done. Three is usually enough. ' +
      'Make a board per project or sprint from the dashboard.',
  },
  {
    art: '🫳',
    title: 'Drag cards to move them',
    body:
      'Grab a card anywhere and drop it in another column. On a phone, press and hold for a moment first, ' +
      'then drag. Changes save the instant you let go.',
  },
  {
    art: '🔥',
    title: 'In Flow has a limit',
    body:
      'That column caps at three cards and glows amber when you go over. It is a nudge, not a wall — ' +
      'it just makes it obvious when too much is in progress at once.',
  },
  {
    art: '🗂️',
    title: 'Open a card for the details',
    body:
      'Tap any card to set priority, labels, a due date and who owns it. ' +
      'Use the filter box up top to narrow a busy board down fast.',
  },
  {
    art: '👥',
    title: 'Teams share boards',
    body:
      'Create a team in the sidebar and share the six-letter invite code. Team boards are visible to ' +
      'everyone who joins, and edits show up within a few seconds without refreshing.',
  },
];

export default function Tour() {
  const { tourOpen, setTourOpen } = useStore();
  const [i, setI] = useState(0);

  if (!tourOpen) return null;

  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const close = () => {
    setTourOpen(false);
    setI(0);
  };

  return (
    <Modal onClose={close}>
      <div className="tour">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="tour-art" aria-hidden="true">{step.art}</div>
            <h3>{step.title}</h3>
            <p className="tour-body">{step.body}</p>
          </motion.div>
        </AnimatePresence>

        <div className="tour-foot">
          <div className="tour-dots">
            {STEPS.map((s, n) => (
              <button
                key={s.title}
                className={`tour-dot${n === i ? ' on' : ''}`}
                aria-label={`Step ${n + 1}: ${s.title}`}
                aria-current={n === i}
                onClick={() => setI(n)}
              />
            ))}
          </div>
          <div className="tour-actions">
            {!last && (
              <button className="btn btn-ghost" onClick={close}>Skip</button>
            )}
            {i > 0 && (
              <button className="btn btn-ghost" onClick={() => setI(i - 1)}>Back</button>
            )}
            <button className="btn btn-primary" onClick={() => (last ? close() : setI(i + 1))}>
              {last ? 'Start using it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
