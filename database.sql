
-- IMPORTANT: quoted so the database name keeps its exact case ("Portfolio"),
-- matching PGDATABASE in .env. Unquoted names get lower-cased by Postgres
-- (CREATE DATABASE Portfolio; actually creates "portfolio"), which then
-- doesn't match PGDATABASE=Portfolio and every query fails to connect.
CREATE DATABASE "Portfolio";


CREATE TABLE IF NOT EXISTS profile (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    description TEXT,
    email VARCHAR(255),
    phone VARCHAR(255),
    location VARCHAR(255),
    github TEXT,
    cv_file_name VARCHAR(255),
    cv_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    tag VARCHAR(100) DEFAULT 'General',
    description TEXT NOT NULL,
    image TEXT DEFAULT '/images/default-project.jpg',
    link TEXT DEFAULT '#projects',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);