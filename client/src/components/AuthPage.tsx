import { FormEvent, useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import { ApiError } from '../api';

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

/** Decorative miniature board — echoes the product, floats gently. */
function MiniBoard() {
  const cols = [
    { pill: '#7fbcf7', cards: [2, 1] },
    { pill: '#5b8def', cards: [2, 1] },
    { pill: '#4ad3a2', cards: [1, 2] },
  ];
  return (
    <motion.div
      className="mini-board"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {cols.map((col, ci) => (
        <div className="mini-col" key={ci}>
          <div className="mini-pill" style={{ background: col.pill }} />
          {col.cards.map((lines, i) => (
            <motion.div
              className="mini-card"
              key={i}
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 3.4 + ci * 0.5 + i * 0.7, repeat: Infinity, ease: 'easeInOut', delay: ci * 0.4 + i * 0.9 }}
            >
              {Array.from({ length: lines }).map((_, li) => (
                <div className="mini-line" key={li} style={{ width: `${82 - li * 30}%`, background: li === lines - 1 && (ci + i) % 2 === 0 ? (ci === 2 ? '#a9ebd4' : '#f7d9a4') : undefined }} />
              ))}
            </motion.div>
          ))}
        </div>
      ))}
    </motion.div>
  );
}

export default function AuthPage() {
  const { login, register } = useStore();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          <Logo />
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          A sprint board that <em>respects flow</em>.
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          Fewer columns, calmer colors, faster triage. Built for busy teams that would rather ship than shuffle tickets.
        </motion.p>
        <MiniBoard />
      </div>

      <div className="auth-form-side">
        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2>{mode === 'register' ? 'Create your account' : 'Welcome back'}</h2>
          <p className="sub">
            {mode === 'register' ? 'Free forever for you and your team.' : 'Pick up right where your team left off.'}
          </p>
          <form onSubmit={submit}>
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
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@team.com" autoFocus={mode === 'login'} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'} required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy} style={{ marginTop: 4, padding: '11px 16px' }}>
              {busy ? 'One sec…' : mode === 'register' ? 'Create account' : 'Sign in'}
            </button>
          </form>
          <div className="auth-switch">
            {mode === 'register' ? 'Already have an account?' : 'New to Loopboard?'}
            <button onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}>
              {mode === 'register' ? 'Sign in' : 'Create one'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
