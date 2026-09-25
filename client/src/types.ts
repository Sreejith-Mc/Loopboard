export interface User {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  /** Set by the server from ADMIN_EMAILS; gates the admin controls. */
  isAdmin?: boolean;
}

export interface KeepaliveRun {
  ranAt: number;
  ok: boolean;
  source: string;
  detail: string;
}

export interface AdminStatus {
  db: { ok: boolean; detail: string };
  runs: KeepaliveRun[];
}

export interface Member extends User {
  role: string;
}

export interface Team {
  id: string;
  name: string;
  inviteCode: string;
  role: string;
  memberCount: number;
}

export interface BoardSummary {
  id: string;
  name: string;
  emoji: string;
  teamId: string | null;
  ownerId: string;
  updatedAt: number;
  cardCount: number;
  doneCount: number;
  /** Cards in the first column. */
  todoCount: number;
  /** Open cards due within two days of the viewer's today, overdue included. */
  dueSoonCount: number;
  /** Open cards whose due date has passed. */
  overdueCount: number;
}

export type Priority = 'none' | 'low' | 'medium' | 'high' | 'urgent';

export interface Card {
  id: string;
  columnId: string;
  title: string;
  description: string;
  priority: Priority;
  labels: string[];
  assigneeId: string | null;
  dueDate: string | null;
  position: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface Column {
  id: string;
  name: string;
  accent: string;
  position: number;
  wipLimit: number | null;
}

export interface Board {
  id: string;
  name: string;
  emoji: string;
  teamId: string | null;
  ownerId: string;
  updatedAt: number;
  columns: Column[];
  cards: Card[];
  members: Member[];
}
