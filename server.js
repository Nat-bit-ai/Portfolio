require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const rootDir = __dirname;
const IS_VERCEL = Boolean(process.env.VERCEL);

// ---------------------------------------------------------------------------
// Admin auth
// ---------------------------------------------------------------------------
// The password can be overridden with the ADMIN_PASSWORD env var. Set that in
// your host's dashboard (Vercel -> Project -> Settings -> Environment Variables)
// instead of relying on the fallback below once this code is in a public repo.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '@Nathy1821';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'natnael-portfolio-admin-secret';
const ADMIN_COOKIE = 'admin_token';
const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signToken(payload) {
  const data = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', ADMIN_SECRET).update(data).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${data}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', ADMIN_SECRET).update(data).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sigBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expectedSig);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch (error) {
    return null;
  }
}

function isAdminRequest(req) {
  const cookies = parseCookies(req);
  const payload = verifyToken(cookies[ADMIN_COOKIE]);
  return Boolean(payload && payload.role === 'admin');
}

function requireAdmin(req, res, next) {
  if (isAdminRequest(req)) return next();
  return res.status(401).json({ error: 'Admin authentication required.' });
}

function setAdminCookie(res, token, maxAgeSeconds) {
  const parts = [
    `${ADMIN_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    'SameSite=Lax'
  ];
  if (IS_VERCEL) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function renderLoginPage(errorMessage) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Admin Login</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #020617, #111827); color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  form { background: rgba(15,23,42,0.9); border: 1px solid rgba(148,163,184,0.2); border-radius: 16px; padding: 32px; width: 280px; box-shadow: 0 18px 30px rgba(2, 6, 23, 0.35); }
  h1 { font-size: 1.2rem; margin: 0 0 16px; }
  input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(148,163,184,0.2); background: rgba(15,23,42,0.7); color: #e2e8f0; margin: 8px 0 16px; font: inherit; }
  button { width: 100%; padding: 10px 12px; border-radius: 10px; border: none; background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; font-weight: 700; cursor: pointer; font: inherit; }
  .error { color: #fca5a5; font-size: 0.85rem; margin: 0 0 12px; }
</style>
</head>
<body>
  <form method="POST" action="/api/admin/login">
    <h1>Admin Login</h1>
    ${errorMessage ? `<p class="error">${errorMessage}</p>` : ''}
    <input type="password" name="password" placeholder="Password" required autofocus />
    <button type="submit">Log In</button>
  </form>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
const REQUIRED_ENV_VARS = ['PGUSER', 'PGPASSWORD', 'PGDATABASE'];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variable(s): ${missingEnvVars.join(', ')}. Set these in your hosting provider's environment settings -- the app will return 500s until they're set.`);
}

const pgHost = process.env.PGHOST || 'localhost';
const isLocalHost = pgHost === 'localhost' || pgHost === '127.0.0.1';
const sslEnabled = process.env.PGSSL ? process.env.PGSSL === 'true' : !isLocalHost;

let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      host: pgHost,
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE,
      ssl: sslEnabled ? { rejectUnauthorized: false } : false
    });
  }
  return pool;
}

async function query(sql, params = []) {
  return getPool().query(sql, params);
}

const DEFAULT_HOMEPAGE_SETTINGS = {
  heroImage: '/images/photo_2026-02-26_07-03-17.jpg',
  techStacks: [
    { name: 'HTML', image: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg' },
    { name: 'CSS', image: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg' },
    { name: 'JavaScript', image: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg' },
    { name: 'Python', image: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg' },
    { name: 'MySQL', image: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mysql/mysql-original.svg' },
    { name: 'C++', image: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cplusplus/cplusplus-original.svg' },
    { name: 'PHP', image: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/php/php-original.svg' },
    { name: 'Git', image: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg' },
    { name: 'GitHub', image: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg' },
    { name: 'Java', image: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg' },
    { name: 'React', image: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg' },
    { name: 'Tailwind CSS', image: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-original.svg' }
  ]
};

function parseTechStacks(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        name: String(item.name || 'Skill').trim(),
        image: String(item.image || '').trim()
      }))
      .filter((item) => item.name);
  }

  if (typeof rawValue !== 'string') {
    return DEFAULT_HOMEPAGE_SETTINGS.techStacks;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return DEFAULT_HOMEPAGE_SETTINGS.techStacks;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parseTechStacks(parsed);
    }
  } catch (error) {
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split('|');
      return {
        name: name.trim(),
        image: rest.join('|').trim()
      };
    })
    .filter((item) => item.name);
}

async function initializeDatabase() {
  await query(`
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
  `);

  await query(`
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
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS site_settings (
      id SERIAL PRIMARY KEY,
      key VARCHAR(100) UNIQUE NOT NULL,
      value JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const profileCheck = await query('SELECT id FROM profile LIMIT 1');
  if (profileCheck.rowCount === 0) {
    await query(`
      INSERT INTO profile (name, title, description, email, phone, location, github, cv_file_name, cv_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      'Natnael Zerihun',
      'Frontend Developer',
      'I build responsive and user-friendly webpages using HTML, CSS and JavaScript with a focus on improving performance and creating better design.',
      'nathyzer21@gmail.com',
      '+251 967 323 308',
      'Addis Ababa, Ethiopia',
      'https://github.com/Nat-bit-ai',
      '',
      ''
    ]);
  }

  const projectsCheck = await query('SELECT COUNT(*)::int AS count FROM projects');
  if (projectsCheck.rows[0].count === 0) {
    await query(`
      INSERT INTO projects (title, tag, description, image, link)
      VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10), ($11, $12, $13, $14, $15)
    `, [
      'E-Commerce App', 'E-Commerce', 'An online store with product browsing, cart management, and a secure checkout flow, built for a smooth shopping experience on any device.', 'images/Screenshot 2026-07-29 021550.png', '#projects',
      'National Voting System', 'Gov Tech', 'A secure digital voting platform built for nationwide elections and easy voter access.', 'images/Screenshot 2026-07-29 020836.png', '#projects',
      'Portfolio Website', 'Portfolio', 'This portfolio site showcases my design approach, visual UI, and project storytelling.', 'images/Screenshot 2026-07-29 023506.png', '#projects'
    ]);
  }

  const homepageCheck = await query('SELECT value FROM site_settings WHERE key = $1', ['homepage']);
  if (homepageCheck.rowCount === 0) {
    await query(`
      INSERT INTO site_settings (key, value)
      VALUES ($1, $2)
    `, ['homepage', JSON.stringify(DEFAULT_HOMEPAGE_SETTINGS)]);
  }
}

let dbInitPromise = null;
function ensureInitialized() {
  if (!dbInitPromise) {
    dbInitPromise = initializeDatabase().catch((error) => {
      dbInitPromise = null; // allow a retry on the next request instead of staying broken forever
      throw error;
    });
  }
  return dbInitPromise;
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------------------------------------------------------------------------
// Uploads (kept in memory, then stored as data URLs in Postgres -- Vercel's
// filesystem is read-only/ephemeral outside /tmp, so writing to disk like the
// old diskStorage setup did won't survive between requests there).
// ---------------------------------------------------------------------------
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function toDataUrl(file) {
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(rootDir));

// Only routes that actually touch Postgres need the DB to be initialized.
// /admin, the login/session endpoints, and the HTML catch-all just check a
// signed cookie or serve a file -- they must keep working even if the DB
// env vars aren't configured yet, otherwise a DB outage/misconfig makes the
// whole admin login unreachable (500 instead of the login form).
const DB_FREE_PATHS = new Set(['/api/admin/login', '/api/admin/logout', '/api/admin/session', '/api/health']);
app.use(asyncHandler(async (req, res, next) => {
  const needsDb = req.path.startsWith('/api') && !DB_FREE_PATHS.has(req.path);
  if (!needsDb) return next();
  await ensureInitialized();
  next();
}));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// --- Admin auth routes ---
app.post('/api/admin/login', (req, res) => {
  const password = (req.body && req.body.password) || '';
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).send(renderLoginPage('Incorrect password.'));
  }
  const token = signToken({ role: 'admin', exp: Date.now() + ADMIN_TOKEN_TTL_MS });
  setAdminCookie(res, token, Math.floor(ADMIN_TOKEN_TTL_MS / 1000));
  return res.redirect('/admin');
});

app.post('/api/admin/logout', (req, res) => {
  setAdminCookie(res, '', 0);
  return res.redirect('/admin');
});

app.get('/api/admin/session', (req, res) => {
  res.json({ authenticated: isAdminRequest(req) });
});

// --- Public read routes ---
app.get('/api/profile', asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM profile ORDER BY id DESC LIMIT 1');
  const profile = result.rows[0];

  if (!profile) {
    return res.status(404).json({ error: 'Profile not found.' });
  }

  return res.json({
    name: profile.name,
    title: profile.title,
    description: profile.description,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    github: profile.github,
    cv: profile.cv_url ? { fileName: profile.cv_file_name, url: profile.cv_url } : { fileName: '', url: '' }
  });
}));

app.get('/api/cv', asyncHandler(async (req, res) => {
  const result = await query('SELECT cv_file_name, cv_url FROM profile ORDER BY id DESC LIMIT 1');
  const profile = result.rows[0];

  if (!profile) {
    return res.json({ fileName: '', url: '' });
  }

  return res.json({
    fileName: profile.cv_file_name || '',
    url: profile.cv_url || ''
  });
}));

app.get('/api/projects', asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM projects ORDER BY id ASC');
  res.json(result.rows);
}));

app.get('/api/homepage', asyncHandler(async (req, res) => {
  const result = await query('SELECT value FROM site_settings WHERE key = $1', ['homepage']);
  const homepage = result.rowCount > 0 ? result.rows[0].value : DEFAULT_HOMEPAGE_SETTINGS;

  res.json({
    heroImage: homepage.heroImage || DEFAULT_HOMEPAGE_SETTINGS.heroImage,
    techStacks: Array.isArray(homepage.techStacks) && homepage.techStacks.length
      ? homepage.techStacks
      : DEFAULT_HOMEPAGE_SETTINGS.techStacks
  });
}));

// --- Admin-only write routes ---
app.put('/api/profile', requireAdmin, asyncHandler(async (req, res) => {
  const profile = req.body;
  const existing = await query('SELECT * FROM profile ORDER BY id DESC LIMIT 1');

  if (existing.rowCount === 0) {
    const inserted = await query(`
      INSERT INTO profile (name, title, description, email, phone, location, github)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      profile.name || 'Natnael Zerihun',
      profile.title || '',
      profile.description || '',
      profile.email || '',
      profile.phone || '',
      profile.location || '',
      profile.github || ''
    ]);

    return res.json(inserted.rows[0]);
  }

  const updated = await query(`
    UPDATE profile
    SET name = $1,
        title = $2,
        description = $3,
        email = $4,
        phone = $5,
        location = $6,
        github = $7,
        updated_at = NOW()
    WHERE id = $8
    RETURNING *
  `, [
    profile.name ?? existing.rows[0].name,
    profile.title ?? existing.rows[0].title,
    profile.description ?? existing.rows[0].description,
    profile.email ?? existing.rows[0].email,
    profile.phone ?? existing.rows[0].phone,
    profile.location ?? existing.rows[0].location,
    profile.github ?? existing.rows[0].github,
    existing.rows[0].id
  ]);

  return res.json(updated.rows[0]);
}));

app.post('/api/cv', requireAdmin, memoryUpload.single('cvFile'), asyncHandler(async (req, res) => {
  const uploaded = req.file;

  if (uploaded) {
    const updated = await query(`
      UPDATE profile
      SET cv_file_name = $1,
          cv_url = $2,
          updated_at = NOW()
      WHERE id = (SELECT id FROM profile ORDER BY id DESC LIMIT 1)
      RETURNING cv_file_name, cv_url
    `, [uploaded.originalname, toDataUrl(uploaded)]);

    return res.json({
      fileName: updated.rows[0].cv_file_name,
      url: updated.rows[0].cv_url
    });
  }

  if (req.body.fileName || req.body.url) {
    const existing = await query('SELECT * FROM profile ORDER BY id DESC LIMIT 1');
    const updated = await query(`
      UPDATE profile
      SET cv_file_name = $1,
          cv_url = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING cv_file_name, cv_url
    `, [
      req.body.fileName || existing.rows[0].cv_file_name,
      req.body.url || existing.rows[0].cv_url,
      existing.rows[0].id
    ]);

    return res.json({
      fileName: updated.rows[0].cv_file_name,
      url: updated.rows[0].cv_url
    });
  }

  return res.status(400).json({ error: 'No CV file uploaded.' });
}));

app.post('/api/projects', requireAdmin, memoryUpload.single('projectImage'), asyncHandler(async (req, res) => {
  const payload = req.file ? { ...req.body, image: toDataUrl(req.file) } : req.body;
  const { title, tag, description, image, link } = payload;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required.' });
  }

  const project = await query(`
    INSERT INTO projects (title, tag, description, image, link)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [
    title,
    tag || 'General',
    description,
    image || '/images/default-project.jpg',
    link || '#projects'
  ]);

  return res.status(201).json(project.rows[0]);
}));

app.put('/api/projects/:id', requireAdmin, memoryUpload.single('projectImage'), asyncHandler(async (req, res) => {
  const existing = await query('SELECT * FROM projects WHERE id = $1', [req.params.id]);

  if (existing.rowCount === 0) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  const payload = req.file ? { ...req.body, image: toDataUrl(req.file) } : req.body;
  const project = await query(`
    UPDATE projects
    SET title = $1,
        tag = $2,
        description = $3,
        image = $4,
        link = $5,
        updated_at = NOW()
    WHERE id = $6
    RETURNING *
  `, [
    payload.title || existing.rows[0].title,
    payload.tag || existing.rows[0].tag,
    payload.description || existing.rows[0].description,
    payload.image || existing.rows[0].image,
    payload.link || existing.rows[0].link,
    req.params.id
  ]);

  return res.json(project.rows[0]);
}));

app.delete('/api/projects/:id', requireAdmin, asyncHandler(async (req, res) => {
  const result = await query('DELETE FROM projects WHERE id = $1 RETURNING *', [req.params.id]);

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  return res.json({ message: 'Project deleted successfully.' });
}));

app.put('/api/homepage', requireAdmin, memoryUpload.single('homepageImage'), asyncHandler(async (req, res) => {
  const existing = await query('SELECT value FROM site_settings WHERE key = $1', ['homepage']);
  const current = existing.rowCount > 0 ? existing.rows[0].value : DEFAULT_HOMEPAGE_SETTINGS;

  const payload = {
    heroImage: req.file ? toDataUrl(req.file) : (req.body.heroImage || current.heroImage || DEFAULT_HOMEPAGE_SETTINGS.heroImage),
    techStacks: parseTechStacks(req.body.techStacks || current.techStacks || DEFAULT_HOMEPAGE_SETTINGS.techStacks)
  };

  const updated = await query(`
    INSERT INTO site_settings (key, value)
    VALUES ($1, $2)
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    RETURNING value
  `, ['homepage', JSON.stringify(payload)]);

  res.json(updated.rows[0].value);
}));

app.get('/api/messages', requireAdmin, asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM messages ORDER BY created_at DESC');
  res.json(result.rows);
}));

app.post('/api/messages', asyncHandler(async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email and message are required.' });
  }

  const result = await query(`
    INSERT INTO messages (name, email, message)
    VALUES ($1, $2, $3)
    RETURNING *
  `, [name, email, message]);

  return res.status(201).json(result.rows[0]);
}));

app.delete('/api/messages/:id', requireAdmin, asyncHandler(async (req, res) => {
  const result = await query('DELETE FROM messages WHERE id = $1 RETURNING *', [req.params.id]);

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Message not found.' });
  }

  return res.json({ message: 'Message deleted successfully.' });
}));

// --- Admin page (password-gated) ---
app.get('/admin', (req, res) => {
  if (!isAdminRequest(req)) {
    return res.status(401).send(renderLoginPage());
  }
  return res.sendFile(path.join(rootDir, 'admin.html'));
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Route not found.' });
  }

  return res.sendFile(path.join(rootDir, 'index.html'));
});

// Final error handler -- turns any thrown/rejected error into JSON instead of
// crashing the whole function (which is what produced the 500 on Vercel).
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal server error.' });
});

if (!IS_VERCEL) {
  ensureInitialized()
    .then(() => {
      const server = app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
      });

      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`Port ${PORT} is already in use. Stop the old Node process and restart the app.`);
          process.exit(1);
        }
        throw error;
      });
    })
    .catch((error) => {
      console.error('Failed to initialize PostgreSQL database:', error.message);
      process.exit(1);
    });
}

module.exports = app;