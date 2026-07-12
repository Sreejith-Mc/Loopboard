import type { Priority } from './types';

export const ACCENTS: Record<string, { dot: string; soft: string; text: string }> = {
  blue: { dot: '#5b8def', soft: '#e8f0fe', text: '#3a6cd4' },
  violet: { dot: '#9b7cf2', soft: '#f1ecfd', text: '#7a5ad0' },
  green: { dot: '#2fbf94', soft: '#e2f7f0', text: '#1f8f6e' },
  amber: { dot: '#f2a54a', soft: '#fdf1e0', text: '#b97516' },
  rose: { dot: '#ef7ba4', soft: '#fdeaf1', text: '#d14b7e' },
  cyan: { dot: '#43b7d8', soft: '#e4f5fa', text: '#3a80a8' },
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
  { bg: 'rgba(91, 141, 239, 0.14)', text: '#5b8def' },
  { bg: 'rgba(47, 191, 148, 0.14)', text: '#27a882' },
  { bg: 'rgba(242, 165, 74, 0.16)', text: '#cf8a2e' },
  { bg: 'rgba(155, 124, 242, 0.14)', text: '#9b7cf2' },
  { bg: 'rgba(239, 123, 164, 0.14)', text: '#e0648f' },
  { bg: 'rgba(67, 183, 216, 0.15)', text: '#3aa2c4' },
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
