import { useEffect } from 'react';
import { useStore } from '../store';
import { timeAgo } from '../utils';

/**
 * Database health, for admins only.
 *
 * Supabase pauses a free-tier project after about a week of no traffic, so a
 * daily cron pings it. This panel shows whether that is actually happening and
 * gives a button to ping on demand — useful when something looks wrong and you
 * want a straight answer about whether the database is reachable.
 *
 * The server decides who is an admin (ADMIN_EMAILS); `user.isAdmin` only
 * decides whether to draw this. The endpoints check independently, so hiding
 * the panel is a courtesy, not the security boundary.
 */
export default function AdminPanel() {
  const { user, adminStatus, adminBusy, loadAdminStatus, runKeepalive } = useStore();

  useEffect(() => {
    if (user?.isAdmin) void loadAdminStatus();
  }, [user?.isAdmin, loadAdminStatus]);

  if (!user?.isAdmin) return null;

  const ok = adminStatus?.db.ok ?? true;
  const last = adminStatus?.runs?.[0];

  return (
    <div className="admin-panel">
      <div className="admin-head">
        <span className={`admin-dot${ok ? '' : ' bad'}`} aria-hidden="true" />
        <span className="admin-label">Database</span>
        <span className="admin-state">{adminStatus ? (ok ? 'Healthy' : 'Unreachable') : 'Checking…'}</span>
      </div>

      <div className="admin-last">
        {last
          ? `Last ping ${timeAgo(last.ranAt)} · ${last.source}`
          : 'No pings recorded yet'}
      </div>

      <button
        className="btn btn-subtle admin-btn"
        onClick={() => void runKeepalive()}
        disabled={adminBusy}
        title="Ping the database now and record the result"
      >
        {adminBusy ? 'Pinging…' : 'Wake database'}
      </button>

      {!ok && adminStatus && (
        <div className="admin-err" title={adminStatus.db.detail}>{adminStatus.db.detail}</div>
      )}
    </div>
  );
}
