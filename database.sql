-- Run this against the database your Postgres provider already created for
-- you (Neon/Supabase/Railway all give you one by default — you usually
-- can't and don't need to CREATE DATABASE yourself on the free tier).
--
-- If you're running Postgres locally and want a database named exactly
-- "Portfolio" (matching PGDATABASE=Portfolio), keep this line. Quoted so
-- the name keeps its exact case — unquoted, Postgres lower-cases it to
-- "portfolio", which then won't match PGDATABASE=Portfolio and every
-- connection will fail.
-- CREATE DATABASE "Portfolio";

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

-- New: the homepage hero image + tech stack icons used to live only in the
-- JSON file. One settings row (id=1) is all this needs.
CREATE TABLE IF NOT EXISTS homepage_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    hero_image TEXT DEFAULT '',
    tech_stacks JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Seed data. Safe to re-run: ON CONFLICT skips rows that already exist.
INSERT INTO profile (id, name, title, description, email, phone, location, github)
VALUES (
    1,
    'Natnael Zerihun',
    'Frontend Developer',
    'I build responsive and user-friendly webpages using HTML, CSS and JavaScript with a focus on improving performance and creating better design.',
    'nathyzer21@gmail.com',
    '+251 967 323 308',
    'Addis Ababa, Ethiopia',
    'https://github.com/Nat-bit-ai'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, title, tag, description, image, link) VALUES
    (1, 'E-Commerce App', 'E-Commerce', 'An online store with product browsing, cart management, and a smooth shopping experience on any device.', 'images/default-project.jpg', '#projects'),
    (2, 'National Voting System', 'Gov Tech', 'A secure digital voting platform built for nationwide elections and easy voter access.', 'images/default-project.jpg', '#projects'),
    (3, 'Portfolio Website', 'Portfolio', 'A personal portfolio that showcases my design approach, visual UI, and project storytelling.', 'images/default-project.jpg', '#projects')
ON CONFLICT (id) DO NOTHING;

-- Keeps the next auto-generated id past the seeded rows above.
SELECT setval(pg_get_serial_sequence('projects', 'id'), (SELECT MAX(id) FROM projects));

INSERT INTO homepage_settings (id, hero_image, tech_stacks)
VALUES (1, '', '[
    {"name":"HTML","image":"https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg"},
    {"name":"CSS","image":"https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg"},
    {"name":"JavaScript","image":"https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg"},
    {"name":"Python","image":"https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg"},
    {"name":"MySQL","image":"https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mysql/mysql-original.svg"},
    {"name":"C++","image":"https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cplusplus/cplusplus-original.svg"},
    {"name":"PHP","image":"https://cdn.jsdelivr.net/gh/devicons/devicon/icons/php/php-original.svg"},
    {"name":"Git","image":"https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg"},
    {"name":"GitHub","image":"https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg"},
    {"name":"Java","image":"https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg"},
    {"name":"React","image":"https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg"},
    {"name":"Tailwind CSS","image":"https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-original.svg"}
]'::jsonb)
ON CONFLICT (id) DO NOTHING;
