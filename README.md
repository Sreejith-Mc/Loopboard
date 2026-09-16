# Loopboard 🌀

A sprint board that respects flow — fewer columns, calmer colors, faster triage for busy teams.

![stack](https://img.shields.io/badge/stack-React%20%2B%20Express%20%2B%20Postgres-5B8DEF)

## What's inside

- **Real accounts & cloud save** — email/password auth with server-side sessions; every change persists instantly to Postgres (Supabase).
- **Teams** — create a team, share the 6-letter invite code, and everyone sees the same boards.
- **Live sync** — teammates' edits show up within a few seconds, no refresh needed.
- **Flow-first boards** — every board starts with just three columns (*Up Next · In Flow · Done*), and "In Flow" ships with a WIP limit that glows amber when the team takes on too much.
- **Fast triage** — inline quick-add on every column, drag-and-drop with a tilted lift animation, instant search filtering, priorities, labels, due dates, and assignees.

## Setup

Loopboard needs a Postgres database. Supabase's free tier is plenty.

**1. Create the database.** Make a project at [supabase.com](https://supabase.com), then open
**SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it.

**2. Get the connection string.** In Supabase go to **Project Settings → Database →
Connection string → URI**, and copy the **Transaction pooler** one (port `6543`) — that's
the pooler built for serverless. Replace `[YOUR-PASSWORD]` with your database password.

**3. Point the app at it.** Copy `.env.example` to `.env` and fill in `DATABASE_URL`.
`.env` is gitignored — never commit it.

```bash
cp .env.example .env
npm install
npm run dev        # API on :8787, app on http://localhost:5173
```

## Deploying to Vercel

The repo is already configured ([`vercel.json`](vercel.json)): the client builds to
`client/dist`, and every `/api/*` request is rewritten to the Express app running as a
serverless function from [`api/index.mjs`](api/index.mjs).

The only manual step is the secret. In your Vercel project go to
**Settings → Environment Variables**, add `DATABASE_URL` with the same Supabase pooler
string, tick all three environments (Production, Preview, Development), and redeploy.

> Without `DATABASE_URL` set in Vercel, the API returns 500s and signup fails. Add it
> *before* the first deploy, or redeploy after adding it — Vercel only picks up new
> environment variables on a fresh build.

## Architecture

```
client/   React 18 + TypeScript + Vite
          @dnd-kit (drag & drop) · framer-motion (animation) · zustand (state)
server/   Express + node-postgres
          scrypt password hashing · httpOnly session cookies
api/      Vercel serverless entrypoint (re-exports the Express app)
supabase/ schema.sql — run once against your database
```

Board access control: personal boards are visible only to their owner; team boards are
visible to team members, checked on every request. Card moves are transactional — positions
are renumbered atomically so two teammates dragging at once can't corrupt an ordering.

**On Supabase and RLS.** The server talks to Postgres directly over the connection string,
as the `postgres` role, which bypasses row-level security. `schema.sql` therefore enables
RLS with *no policies* on every table: that has no effect on the server, but it slams the
door on Supabase's auto-generated REST API, which would otherwise expose these tables to
anyone holding the project's anon key. Don't add policies unless you mean to open that up.

**On live sync.** Serverless functions can't hold a connection open, so instead of the
Server-Sent Events stream this used to use, the client polls a small
`GET /api/boards/:id/version` endpoint every 4 seconds and refetches the board only when
its `updatedAt` actually changes. Backgrounded tabs skip the poll entirely.
