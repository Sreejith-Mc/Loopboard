import { Component, ReactNode, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from './store';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import BoardView from './components/BoardView';
import Toasts from './components/Toasts';
import CommandPalette from './components/CommandPalette';
import Modal from './components/Modal';
import Tour from './components/Tour';
import { BoardSkeleton, DashboardSkeleton } from './components/Skeletons';

const SHORTCUTS: [string, string][] = [
  ['Ctrl K', 'Open the command palette'],
  ['/', 'Filter cards on the board'],
  ['N', 'New card in the first column'],
  ['Esc', 'Close dialogs and menus'],
  ['?', 'Show this cheat sheet'],
];

/** Last line of defense: a crash should show a way back, never a blank page. */
class ErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  render() {
    if (this.state.crashed) {
      return (
        <div className="page-loading" style={{ flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 34 }}>😵‍💫</div>
          <div style={{ fontWeight: 700 }}>Something went sideways</div>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload Loopboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function isTyping() {
  const el = document.activeElement;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el as HTMLElement).isContentEditable);
}

export default function App() {
  const { authChecked, user, board, boardLoading, init, paletteOpen, setPaletteOpen } = useStore();
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    void init();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (useStore.getState().user) setPaletteOpen(!useStore.getState().paletteOpen);
        return;
      }
      if (e.key === '?' && !isTyping() && useStore.getState().user) {
        e.preventDefault();
        setShowShortcuts((s) => !s);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  let view: 'loading' | 'auth' | 'dash' | 'board' | 'board-loading';
  if (!authChecked) view = 'loading';
  else if (!user) view = 'auth';
  else if (board) view = 'board';
  else if (boardLoading) view = 'board-loading';
  else view = 'dash';

  if (view === 'board-loading') return <BoardSkeleton />;

  if (view === 'loading') {
    // Show the shell the user is actually heading for. We can't know whether
    // the session is still valid until /me answers, so lean on whether the
    // last visit was signed in — a returning user gets the real layout
    // straight away, and a signed-out visitor gets no misleading scaffolding.
    const expectSession = localStorage.getItem('lb-had-session') === '1';
    if (!expectSession) return <div className="page-loading" />;
    return window.location.hash.startsWith('#/board/') ? <BoardSkeleton /> : <DashboardSkeleton />;
  }

  return (
    <ErrorBoundary>
      <AnimatePresence mode="wait">
        {view === 'auth' && (
          <motion.div
            key="auth"
            style={{ height: '100%' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25 }}
          >
            <AuthPage />
          </motion.div>
        )}
        {view === 'dash' && (
          <motion.div
            key="dash"
            style={{ height: '100%' }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <Dashboard />
          </motion.div>
        )}
        {view === 'board' && (
          <motion.div
            key={`board-${board!.id}`}
            style={{ height: '100%' }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <BoardView />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {paletteOpen && user && <CommandPalette key="palette" />}
        {user && <Tour key="tour" />}
        {showShortcuts && (
          <Modal key="shortcuts" onClose={() => setShowShortcuts(false)}>
            <h3>Keyboard shortcuts</h3>
            <div>
              {SHORTCUTS.map(([keys, what]) => (
                <div className="shortcut-row" key={keys}>
                  <span>{what}</span>
                  <kbd>{keys}</kbd>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setShowShortcuts(false)}>
                Got it
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
      <Toasts />
    </ErrorBoundary>
  );
}
