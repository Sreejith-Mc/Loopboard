import type { Priority } from './types';

export const ACCENTS: Record<string, { dot: string; soft: string; text: string }> = {
  blue: { dot: '#5b6cff', soft: '#ebedff', text: '#4150e0' },
  violet: { dot: '#8b5cf6', soft: '#f1ebff', text: '#6d3fd6' },
  green: { dot: '#14b88a', soft: '#ddf6ee', text: '#0b8a67' },
  amber: { dot: '#f59e0b', soft: '#fdf1dc', text: '#b56d05' },
  rose: { dot: '#ec5b91', soft: '#fde8f0', text: '#c93a72' },
  cyan: { dot: '#0ea5c6', soft: '#dff4f9', text: '#0b7d97' },
};
export const ACCENT_NAMES = Object.keys(ACCENTS);

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

// Translucent chip colors read well on both light and dark surfaces.
const LABEL_PALETTES = [
  { bg: 'rgba(91, 108, 255, 0.14)', text: '#5b6cff' },
  { bg: 'rgba(20, 184, 138, 0.14)', text: '#0fa37a' },
  { bg: 'rgba(245, 158, 11, 0.16)', text: '#c97f06' },
  { bg: 'rgba(139, 92, 246, 0.14)', text: '#8b5cf6' },
  { bg: 'rgba(236, 91, 145, 0.14)', text: '#dc4a82' },
  { bg: 'rgba(14, 165, 198, 0.15)', text: '#0c93b0' },
];

export function labelColor(label: string) {
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return LABEL_PALETTES[h % LABEL_PALETTES.length];
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export function formatDue(dueDate: string): { text: string; state: 'ok' | 'soon' | 'overdue' } {
  const due = new Date(dueDate + 'T23:59:59');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((due.getTime() - today.getTime()) / 86_400_000);
  const text = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (days < 0) return { text, state: 'overdue' };
  if (days === 0) return { text: 'Today', state: 'soon' };
  if (days === 1) return { text: 'Tomorrow', state: 'soon' };
  return { text, state: 'ok' };
}

export function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const BOARD_EMOJIS = ['🌀', '🚀', '🎯', '🌿', '⚡', '🧭', '🎨', '📦', '🔭', '🌊'];
