import { initials } from '../utils';

export default function Avatar({ name, color, small, title }: { name: string; color: string; small?: boolean; title?: string }) {
  return (
    <span className={`avatar${small ? ' sm' : ''}`} style={{ background: color }} title={title ?? name}>
      {initials(name)}
    </span>
  );
}
