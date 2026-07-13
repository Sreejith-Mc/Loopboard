import { FormEvent, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../store';
import { ApiError } from '../api';

const TESTIMONIALS = [
  {
    quote: 'Loopboard replaced our sprint spreadsheet in one afternoon. The flow limits alone cut our cycle time in half.',
    name: 'Maya Chen',
    role: 'Engineering Lead',
  },
  {
    quote: 'Finally a board that doesn’t feel like homework. My team actually keeps it updated — that never happened before.',
    name: 'Arjun Nair',
    role: 'Product Manager',
  },
  {
    quote: 'Three columns. Calm colors. Zero chaos. It’s the first tool that respects how we actually work.',
    name: 'Sofia Reyes',
    role: 'Design Director',
  },
];

function Logo() {
  return (
    <span className="logo">
      <span className="logo-mark">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <rect x="5" y="4" width="5" height="16" rx="2.5" fill="#fff" />
          <rect x="14" y="4" width="5" height="10" rx="2.5" fill="#fff" opacity="0.85" />
        </svg>
      </span>
      Loopboard
    </span>
  );
}

/** A laptop running Loopboard: three mini columns and a card that keeps
 *  drifting from "Up Next" to "Done" — the product pitch, animated. */
function LaptopMockup() {
  const cols = [
    { accent: '#7fbcf7', cards: 2 },
    { accent: '#9b7cf2', cards: 1 },
    { accent: '#4ad3a2', cards: 2 },
  ];
  return (
    <motion.div className="laptop" animate={{ y: [0, -9, 0] }} transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}>
      <div className="laptop-screen">
        <div className="lap-top">
          <span className="lap-dot" style={{ background: '#ef7ba4' }} />
          <span className="lap-dot" style={{ background: '#f2a54a' }} />
          <span className="lap-dot" style={{ background: '#2fbf94' }} />
          <span className="lap-title" />
        </div>
        <div className="lap-cols">
          {cols.map((c, i) => (
            <div className="lap-col" key={i}>
              <span className="lap-pill" style={{ background: c.accent }} />
              {Array.from({ length: c.cards }).map((_, j) => (
                <div className="lap-card" key={j}>
                  <span className="lap-line" style={{ width: '82%' }} />
                  <span className="lap-line" style={{ width: '52%', background: j === 0 ? `${c.accent}66` : undefined }} />
                </div>
              ))}
            </div>
          ))}
          <motion.div
            className="lap-card lap-flying"
            animate={{
              x: [0, 0, 107, 107, 214, 214, 214],
              y: [66, 62, 30, 34, 62, 66, 66],
              rotate: [0, -3, 3, 0, 3, 0, 0],
              scale: [1, 1.07, 1.07, 1, 1.07, 1, 1],
              opacity: [1, 1, 1, 1, 1, 1, 0],
            }}
            transition={{ duration: 7.5, times: [0, 0.1, 0.28, 0.4, 0.62, 0.74, 1], repeat: Infinity, repeatDelay: 0.8, ease: 'easeInOut' }}
          >
            <span className="lap-line" style={{ width: '75%' }} />
            <span className="lap-line" style={{ width: '45%', background: '#f2a54a88' }} />
          </motion.div>
        </div>
      </div>
      <div className="laptop-base" />
    </motion.div>
  );
}

export default function AuthPage() {
  const { login, register } = useStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setQuote((q) => (q + 1) % TESTIMONIALS.length), 6000);
    return () => clearInterval(t);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'register') await register(name, email, password);
      else await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong — try again');
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: 'login' | 'register') {
    if (next !== mode) {
      setMode(next);
      setError('');
    }
  }

  const t = TESTIMONIALS[quote];

  return (
    <div className="auth-shell">
      <motion.aside
        className="auth-visual"
        initial={{ opacity: 0, x: -28, scale: 0.985 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="vis-kicker"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.45 }}
        >
          🌀 A sprint board that respects flow
        </motion.div>

        <LaptopMockup />

        <div className="vis-bottom">
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={quote}
              className="vis-quote"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              “{t.quote}”
              <footer>
                <span className="vis-author">{t.name}</span>
                <span className="vis-role">{t.role}</span>
              </footer>
            </motion.blockquote>
          </AnimatePresence>
          <div className="vis-nav">
            <button aria-label="Previous story" onClick={() => setQuote((q) => (q - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button aria-label="Next story" onClick={() => setQuote((q) => (q + 1) % TESTIMONIALS.length)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
            <span className="vis-dots">
              {TESTIMONIALS.map((_, i) => (
                <button key={i} className={i === quote ? 'on' : ''} aria-label={`Story ${i + 1}`} onClick={() => setQuote(i)} />
              ))}
            </span>
          </div>
        </div>
      </motion.aside>

      <motion.main
        className="auth-panel"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Logo />

        <div className="panel-center">
          <motion.h2 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.4 }}>
            Let’s get you in flow
          </motion.h2>
          <motion.p className="panel-sub" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34, duration: 0.4 }}>
            Sign in, or create a free account if you’re new to Loopboard.
          </motion.p>

          <motion.div className="auth-tabs" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4 }}>
            {(
              [
                ['login', 'Sign in'],
                ['register', 'Create account'],
              ] as const
            ).map(([value, label]) => (
              <button key={value} className={mode === value ? 'on' : ''} onClick={() => switchMode(value)}>
                {mode === value && <motion.span className="tab-pill" layoutId="auth-tab-pill" transition={{ type: 'spring', stiffness: 480, damping: 36 }} />}
                <span className="tab-label">{label}</span>
              </button>
            ))}
          </motion.div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.form
              key={mode}
              onSubmit={submit}
              initial={{ opacity: 0, x: mode === 'register' ? 26 : -26 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: mode === 'register' ? -26 : 26 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {error && (
                <motion.div className="form-error" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                  {error}
                </motion.div>
              )}
              {mode === 'register' && (
                <div className="field">
                  <label>Name</label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoFocus required />
                </div>
              )}
              <div className="field">
                <label>Email</label>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@team.com"
                  autoFocus={mode === 'login'}
                  required
                />
              </div>
              <div className="field">
                <label>Password</label>
                <div className="pw-wrap">
                  <input
                    className="input"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'}
                    required
                  />
                  <button type="button" className="pw-eye" title={showPw ? 'Hide password' : 'Show password'} onClick={() => setShowPw(!showPw)}>
                    {showPw ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                        <path d="m1 1 22 22" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <motion.button className="btn-cta" type="submit" disabled={busy} whileHover={{ y: -1.5 }} whileTap={{ scale: 0.98 }}>
                {busy ? 'One sec…' : mode === 'register' ? 'Create free account' : 'Sign in'}
              </motion.button>
            </motion.form>
          </AnimatePresence>
        </div>

        <motion.div className="panel-foot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
          Free forever for small teams · your data stays on your server
        </motion.div>
      </motion.main>
    </div>
  );
}
