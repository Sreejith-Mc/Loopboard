# Loopboard 🌀

A sprint board that respects flow — fewer columns, calmer colors, faster triage for busy teams.

![stack](https://img.shields.io/badge/stack-React%20%2B%20Express%20%2B%20SQLite-5B8DEF)

## What's inside

- **Real accounts & cloud save** — email/password auth with server-side sessions; every change persists instantly to a SQLite database on the server.
- **Teams** — create a team, share the 6-letter invite code, and everyone sees the same boards.
- **Live sync** — teammates' edits stream in over Server-Sent Events; no refresh needed.
- **Flow-first boards** — every board starts with just three columns (*Up Next · In Flow · Done*), and "In Flow" ships with a WIP limit that glows amber when the team takes on too much.
- **Fast triage** — inline quick-add on every column, drag-and-drop with a tilted lift animation, instant search filtering, priorities, labels, due dates, and assignees.

## Run it

```bash
npm install
npm run dev        # API on :8787, app on http://localhost:5173
```

## Production

```bash
npm run build      # builds the client
npm start          # one process serves API + app on :8787
```

Set `API_PORT` to change the port. The database lives in `server/data/loopboard.db` — back that file up and you've backed up everything.

## Architecture

```
client/   React 18 + TypeScript + Vite
          @dnd-kit (drag & drop) · framer-motion (animation) · zustand (state)
server/   Express + better-sqlite3 (WAL mode)
          scrypt password hashing · httpOnly session cookies · SSE live sync
```

Board access control: personal boards are visible only to their owner; team boards are visible to team members, checked on every request. Card moves are transactional — positions are renumbered atomically so two teammates dragging at once can't corrupt an ordering.
