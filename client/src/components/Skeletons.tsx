/**
 * Loading placeholders shaped like the content that replaces them.
 *
 * The point is that nothing jumps: a skeleton occupies the same space and
 * rhythm as the real thing, so the page settles instead of reflowing. The
 * shimmer is one shared animation, and it stops entirely under
 * prefers-reduced-motion (see styles.css).
 */

function Bar({ w, h = 10 }: { w: string | number; h?: number }) {
  return <span className="sk" style={{ width: w, height: h }} />;
}

/** The board grid on the dashboard, while the workspace loads. */
export function BoardTilesSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="boards-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="board-tile sk-tile" key={i}>
          <span className="sk sk-emoji" />
          <Bar w="62%" h={13} />
          <Bar w="42%" h={10} />
          <span className="sk sk-progress" />
        </div>
      ))}
    </div>
  );
}

/** Whole dashboard shell, for the very first paint. */
export function DashboardSkeleton() {
  return (
    <div className="dash" aria-busy="true" aria-label="Loading your boards">
      <aside className="sidebar sk-side">
        <div className="sk-side-logo">
          <span className="sk sk-logo" />
          <Bar w={96} h={13} />
        </div>
        {[72, 58, 64].map((w, i) => (
          <div className="sk-side-row" key={i}>
            <span className="sk sk-dot" />
            <Bar w={w} h={11} />
          </div>
        ))}
      </aside>
      <main className="dash-main">
        <div className="topbar">
          <span className="sk" style={{ width: 'min(380px, 60%)', height: 38, borderRadius: 999 }} />
          <span className="sk" style={{ width: 38, height: 38, borderRadius: '50%', marginLeft: 'auto' }} />
        </div>
        <div className="page-head">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Bar w={200} h={28} />
            <Bar w={260} h={12} />
          </div>
        </div>
        <div className="stats">
          {[0, 1, 2, 3].map((i) => (
            <div className="stat-card" key={i}>
              <Bar w="55%" h={13} />
              <span className="sk" style={{ width: 64, height: 40, marginTop: 10 }} />
              <Bar w="70%" h={10} />
            </div>
          ))}
        </div>
        <BoardTilesSkeleton />
      </main>
    </div>
  );
}

/** Columns and cards, while a board loads. */
export function BoardSkeleton() {
  const shape = [3, 2, 2];
  return (
    <div className="board-page" aria-busy="true" aria-label="Loading board">
      <div className="board-topbar">
        <span className="sk sk-dot" />
        <Bar w={170} h={15} />
      </div>
      <div className="board-scroll">
        {shape.map((cards, c) => (
          <div className="column sk-column" key={c}>
            <div className="column-header">
              <span className="sk sk-dot" />
              <Bar w={92} h={12} />
            </div>
            <div className="column-cards">
              {Array.from({ length: cards }, (_, n) => (
                <div className="sk-card" key={n}>
                  <Bar w={n % 2 ? '58%' : '80%'} h={11} />
                  <Bar w="34%" h={9} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
