import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../store';

export default function ThemeToggle() {
  const { theme, setTheme } = useStore();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button className="btn-icon" title={`Switch to ${next} mode`} onClick={() => setTheme(next)} style={{ position: 'relative', width: 33, height: 33 }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          style={{ display: 'inline-flex' }}
        >
          {theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4.5" />
              <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
            </svg>
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
