# Natnael Portfolio — fixed package

This copy fixes the admin editor error caused by the original server requiring PostgreSQL at `127.0.0.1:5432`.

## What changed

- Uses a persistent local JSON store at `data/store.json`.
- Seeds the default profile, projects, and homepage settings automatically.
- Profile values load in the admin page even when PostgreSQL is not installed or running.
- Profile edits, project edits, deletes, homepage settings, messages, and uploads persist between restarts.
- Keeps the original portfolio design and admin page.
- Does not include any uploaded environment secrets.

## Run it

1. Install Node.js 18 or newer.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env`.
5. Set `ADMIN_PASSWORD` and `ADMIN_SECRET` in `.env`.
6. Run `npm start`.
7. Open `http://localhost:3000`.
8. Open `http://localhost:3000/admin` to edit the profile.

The app does not need PostgreSQL in this mode. Do not copy the old `PGHOST=127.0.0.1` settings into this package unless you intentionally add a PostgreSQL adapter.