import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../store';

export default function Toasts() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="toast-stack">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`toast ${t.kind}`}
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 480, damping: 32 }}
            onClick={() => !t.action && dismissToast(t.id)}
          >
            {t.message}
            {t.action && (
              <button
                className="toast-action"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissToast(t.id);
                  t.action!.run();
                }}
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
