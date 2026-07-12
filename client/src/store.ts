import { create } from 'zustand';
import { api, ApiError, CLIENT_ID } from './api';
import type { Board, BoardSummary, Card, Team, User } from './types';

export interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'error' | 'success';
  action?: { label: string; run: () => void };
}

export type Theme = 'light' | 'dark';

function initialTheme(): Theme {
  const saved = localStorage.getItem('lb-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface State {
  authChecked: boolean;
  user: User | null;
  teams: Team[];
  boards: BoardSummary[];
  board: Board | null;
  boardLoading: boolean;
  toasts: Toast[];
  theme: Theme;
  openCardId: string | null;
  quickAddColumnId: string | null;
  paletteOpen: boolean;

  setTheme: (theme: Theme) => void;
  setOpenCard: (id: string | null) => void;
  setQuickAddColumn: (id: string | null) => void;
  setPaletteOpen: (open: boolean) => void;

  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;

  loadWorkspace: () => Promise<void>;
  openBoard: (id: string) => Promise<void>;
  closeBoard: () => void;
  refreshBoard: () => Promise<void>;

  createTeam: (name: string) => Promise<Team>;
  joinTeam: (code: string) => Promise<void>;
  leaveTeam: (id: string) => Promise<void>;

  createBoard: (name: string, emoji: string, teamId: string | null) => Promise<string>;
  renameBoard: (name: string, emoji: string) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;

  addColumn: (name: string, accent: string, wipLimit: number | null) => Promise<void>;
  updateColumn: (id: string, patch: { name?: string; accent?: string; wipLimit?: number | null }) => Promise<void>;
  deleteColumn: (id: string) => Promise<void>;

  addCard: (columnId: string, title: string) => Promise<void>;
  updateCard: (id: string, patch: Partial<Card>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  moveCardLocal: (cardId: string, columnId: string, index: number) => void;
  commitCardMove: (cardId: string, columnId: string, index: number) => Promise<void>;

  toast: (message: string, kind?: Toast['kind'], action?: Toast['action']) => void;
  dismissToast: (id: number) => void;
}

let toastSeq = 0;
let eventSource: EventSource | null = null;

function boardIdFromHash(): string | null {
  const m = window.location.hash.match(/^#\/board\/([\w-]+)/);
  return m ? m[1] : null;
}

/** Subscribe to a board's live-sync stream; refetch on teammates' edits. */
function connectEvents(boardId: string, onRemoteChange: () => void) {
  eventSource?.close();
  eventSource = new EventSource(`/api/boards/${boardId}/events`);
  eventSource.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      if (data.originClientId !== CLIENT_ID) onRemoteChange();
    } catch {
      /* ignore malformed events */
    }
  };
}

/** Reorder the flat card list so `cardId` sits at `index` within `columnId`. */
function applyMove(cards: Card[], cardId: string, columnId: string, index: number): Card[] {
  const card = cards.find((c) => c.id === cardId);
  if (!card) return cards;
  const rest = cards.filter((c) => c.id !== cardId);
  const target = rest.filter((c) => c.columnId === columnId).sort((a, b) => a.position - b.position);
  const clamped = Math.max(0, Math.min(index, target.length));
  target.splice(clamped, 0, { ...card, columnId });
  target.forEach((c, i) => (c.position = i));
  const others = rest.filter((c) => c.columnId !== columnId);
  if (card.columnId !== columnId) {
    others
      .filter((c) => c.columnId === card.columnId)
      .sort((a, b) => a.position - b.position)
      .forEach((c, i) => (c.position = i));
  }
  return [...others, ...target];
}

const startTheme = initialTheme();
document.documentElement.dataset.theme = startTheme;

export const useStore = create<State>((set, get) => ({
  authChecked: false,
  user: null,
  teams: [],
  boards: [],
  board: null,
  boardLoading: false,
  toasts: [],
  theme: startTheme,
  openCardId: null,
  quickAddColumnId: null,
  paletteOpen: false,

  setTheme: (theme) => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('lb-theme', theme);
    set({ theme });
  },
  setOpenCard: (id) => set({ openCardId: id }),
  setQuickAddColumn: (id) => set({ quickAddColumnId: id }),
  setPaletteOpen: (open) => set({ paletteOpen: open }),

  init: async () => {
    try {
      const { user } = await api.get<{ user: User }>('/api/auth/me');
      const boardId = boardIdFromHash();
      if (boardId) {
        // Deep link straight into the board — no dashboard flash.
        try {
          const { board } = await api.get<{ board: Board }>(`/api/boards/${boardId}`);
          set({ user, authChecked: true, board });
          connectEvents(board.id, () => void get().refreshBoard());
        } catch {
          window.location.hash = '';
          set({ user, authChecked: true });
        }
        void get().loadWorkspace();
      } else {
        set({ user, authChecked: true });
        await get().loadWorkspace();
      }
    } catch {
      set({ authChecked: true });
    }
    window.addEventListener('hashchange', async () => {
      const id = boardIdFromHash();
      const { board, user } = get();
      if (!user) return;
      if (id && id !== board?.id) await get().openBoard(id);
      if (!id && board) get().closeBoard();
    });
  },

  login: async (email, password) => {
    const { user } = await api.post<{ user: User }>('/api/auth/login', { email, password });
    set({ user });
    await get().loadWorkspace();
  },

  register: async (name, email, password) => {
    const { user } = await api.post<{ user: User }>('/api/auth/register', { name, email, password });
    set({ user });
    await get().loadWorkspace();
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      /* session may already be gone */
    }
    eventSource?.close();
    eventSource = null;
    window.location.hash = '';
    set({ user: null, teams: [], boards: [], board: null });
  },

  loadWorkspace: async () => {
    const data = await api.get<{ teams: Team[]; boards: BoardSummary[] }>('/api/workspace');
    set({ teams: data.teams, boards: data.boards });
  },

  openBoard: async (id) => {
    set({ boardLoading: true });
    try {
      const { board } = await api.get<{ board: Board }>(`/api/boards/${id}`);
      set({ board, boardLoading: false });
      if (window.location.hash !== `#/board/${id}`) window.location.hash = `#/board/${id}`;
      connectEvents(id, () => void get().refreshBoard());
    } catch (e) {
      set({ boardLoading: false });
      get().toast(e instanceof ApiError ? e.message : 'Couldn’t open that board', 'error');
      window.location.hash = '';
    }
  },

  closeBoard: () => {
    eventSource?.close();
    eventSource = null;
    if (window.location.hash) window.location.hash = '';
    set({ board: null });
    void get().loadWorkspace();
  },

  refreshBoard: async () => {
    const id = get().board?.id;
    if (!id) return;
    try {
      const { board } = await api.get<{ board: Board }>(`/api/boards/${id}`);
      if (get().board?.id === id) set({ board });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        get().toast('This board was deleted', 'info');
        get().closeBoard();
      }
    }
  },

  createTeam: async (name) => {
    const { team } = await api.post<{ team: Team }>('/api/teams', { name });
    await get().loadWorkspace();
    return team;
  },

  joinTeam: async (code) => {
    const { team } = await api.post<{ team: Team }>('/api/teams/join', { code });
    await get().loadWorkspace();
    get().toast(`Welcome to ${team.name}!`, 'success');
  },

  leaveTeam: async (id) => {
    await api.post(`/api/teams/${id}/leave`);
    await get().loadWorkspace();
  },

  createBoard: async (name, emoji, teamId) => {
    const { board } = await api.post<{ board: Board }>('/api/boards', { name, emoji, teamId });
    await get().loadWorkspace();
    return board.id;
  },

  renameBoard: async (name, emoji) => {
    const board = get().board;
    if (!board) return;
    set({ board: { ...board, name, emoji } });
    await api.patch(`/api/boards/${board.id}`, { name, emoji });
  },

  deleteBoard: async (id) => {
    await api.del(`/api/boards/${id}`);
    if (get().board?.id === id) get().closeBoard();
    else await get().loadWorkspace();
  },

  addColumn: async (name, accent, wipLimit) => {
    const board = get().board;
    if (!board) return;
    await api.post(`/api/boards/${board.id}/columns`, { name, accent, wipLimit });
    await get().refreshBoard();
  },

  updateColumn: async (id, patch) => {
    const board = get().board;
    if (!board) return;
    set({
      board: {
        ...board,
        columns: board.columns.map((c) => (c.id === id ? { ...c, ...patch, wipLimit: patch.wipLimit === undefined ? c.wipLimit : patch.wipLimit } : c)),
      },
    });
    await api.patch(`/api/columns/${id}`, patch);
  },

  deleteColumn: async (id) => {
    const board = get().board;
    if (!board) return;
    set({
      board: {
        ...board,
        columns: board.columns.filter((c) => c.id !== id),
        cards: board.cards.filter((c) => c.columnId !== id),
      },
    });
    await api.del(`/api/columns/${id}`);
  },

  addCard: async (columnId, title) => {
    const board = get().board;
    if (!board) return;
    await api.post(`/api/columns/${columnId}/cards`, { title });
    await get().refreshBoard();
  },

  updateCard: async (id, patch) => {
    const board = get().board;
    if (!board) return;
    set({
      board: {
        ...board,
        cards: board.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
    });
    try {
      await api.patch(`/api/cards/${id}`, patch);
    } catch (e) {
      get().toast('Couldn’t save the card — check your connection', 'error');
      await get().refreshBoard();
    }
  },

  deleteCard: async (id) => {
    const board = get().board;
    if (!board) return;
    const snapshot = board.cards.find((c) => c.id === id);
    set({ board: { ...board, cards: board.cards.filter((c) => c.id !== id), }, openCardId: null });
    await api.del(`/api/cards/${id}`);
    if (snapshot) {
      get().toast('Card deleted', 'info', {
        label: 'Undo',
        run: async () => {
          try {
            await api.post(`/api/columns/${snapshot.columnId}/cards`, {
              title: snapshot.title,
              description: snapshot.description,
              priority: snapshot.priority,
              labels: snapshot.labels,
              assigneeId: snapshot.assigneeId,
              dueDate: snapshot.dueDate,
            });
            await get().refreshBoard();
            get().toast('Card restored', 'success');
          } catch {
            get().toast('Couldn’t restore the card', 'error');
          }
        },
      });
    }
  },

  moveCardLocal: (cardId, columnId, index) => {
    const board = get().board;
    if (!board) return;
    set({ board: { ...board, cards: applyMove(board.cards, cardId, columnId, index) } });
  },

  commitCardMove: async (cardId, columnId, index) => {
    get().moveCardLocal(cardId, columnId, index);
    try {
      await api.post(`/api/cards/${cardId}/move`, { columnId, index });
    } catch {
      get().toast('Couldn’t save that move — restoring', 'error');
      await get().refreshBoard();
    }
  },

  toast: (message, kind = 'info', action) => {
    const id = ++toastSeq;
    set({ toasts: [...get().toasts, { id, message, kind, action }] });
    setTimeout(() => get().dismissToast(id), action ? 6000 : 3500);
  },

  dismissToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));
