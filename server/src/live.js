/**
 * Live sync via Server-Sent Events. Clients subscribe per board; any mutation
 * to that board broadcasts a "changed" event, and clients refetch. Mutations
 * carry an X-Client-Id header so the originating client can ignore its own echo.
 */
const channels = new Map(); // boardId -> Set<res>

export function subscribe(boardId, res) {
  if (!channels.has(boardId)) channels.set(boardId, new Set());
  channels.get(boardId).add(res);
  res.on('close', () => {
    const set = channels.get(boardId);
    if (set) {
      set.delete(res);
      if (set.size === 0) channels.delete(boardId);
    }
  });
}

export function broadcast(boardId, originClientId) {
  const set = channels.get(boardId);
  if (!set) return;
  const payload = `data: ${JSON.stringify({ boardId, originClientId, at: Date.now() })}\n\n`;
  for (const res of set) res.write(payload);
}
