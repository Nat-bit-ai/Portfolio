# Natnael Portfolio — Postgres-backed

## What changed from the version you had

The old `server.js` wrote to a local JSON file (`data/store.json`). On Vercel
that file lived in `/tmp`, which is wiped on every cold start and every
deployment — that's why admin edits didn't show up on the homepage, default
fields looked wrong, and contact messages never reached `/admin`.

This version replaces that with real Postgres queries (`db.js` +
`server.js`), matching `database.sql`. Nothing in `public/` needed to
change — the frontend already just calls `/api/...`, so it works as-is.

## 1. Get a Postgres database Vercel can actually reach

A database running only on your own computer (`PGHOST=localhost`) will
**not** work once deployed — Vercel's servers can't reach your machine.
Use a free hosted Postgres instead:

- [Neon](https://neon.tech) — easiest with Vercel, generous free tier
- [Supabase](https://supabase.com), [Railway](https://railway.app), or
  [Render](https://render.com) all work the same way

Create a project, then copy the connection string it gives you (looks like
`postgresql://user:password@host/dbname?sslmode=require`).

## 2. Load the schema

Run `database.sql` against that database once, e.g.:

```
psql "postgresql://user:password@host/dbname?sslmode=require" -f database.sql
```

(Most providers also let you paste SQL into a web-based query editor in
their dashboard if you don't have `psql` installed.)

## 3. Configure environment variables

Locally: copy `.env.example` to `.env`, fill in `DATABASE_URL` (from step 1),
`ADMIN_PASSWORD`, and `ADMIN_SECRET`.

**On Vercel:** `.env` is git-ignored and never gets deployed. You must add
the same variables in your Vercel project — **Settings → Environment
Variables** — for `DATABASE_URL`, `ADMIN_PASSWORD`, and `ADMIN_SECRET`, then
redeploy. This is the step that's easy to miss and will otherwise leave
production connecting to nothing.

## 4. Run it

```
npm install
npm start
```

Open `http://localhost:3000`, and `http://localhost:3000/admin` to edit
content. Once `DATABASE_URL` is set on Vercel and you redeploy, admin edits
and contact messages will persist there too.
