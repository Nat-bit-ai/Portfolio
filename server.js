function loadDotEnv() {
  const envFile = path.join(__dirname, '.env');
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!process.env[key]) process.env[key] = value;
  }
}

const fs = require('fs');
const path = require('path');
loadDotEnv();

const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const pool = require('./db');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const rootDir = __dirname;
const publicDir = path.join(rootDir, 'public');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '@Nathy1821';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'change-this-admin-secret';
const ADMIN_COOKIE = 'admin_token';
const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

const DEFAULT_TECH_STACKS = [
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
];

function parseCookies(req) {
  const cookies = {};
  const header = req.headers.cookie;
  if (!header) return cookies;
  header.split(';').forEach((pair) => {
    const separator = pair.indexOf('=');
    if (separator === -1) return;
    cookies[pair.slice(0, separator).trim()] = decodeURIComponent(pair.slice(separator + 1).trim());
  });
  return cookies;
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signToken(payload) {
  const data = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', ADMIN_SECRET).update(data).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${data}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [data, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', ADMIN_SECRET).update(data).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
    return payload.exp && Date.now() <= payload.exp ? payload : null;
  } catch {
    return null;
  }
}

function isAdminRequest(req) {
  const payload = verifyToken(parseCookies(req)[ADMIN_COOKIE]);
  return Boolean(payload && payload.role === 'admin');
}

function requireAdmin(req, res, next) {
  if (isAdminRequest(req)) return next();
  return res.status(401).json({ error: 'Admin authentication required.' });
}

function setAdminCookie(res, token, maxAgeSeconds) {
  res.setHeader('Set-Cookie', [
    `${ADMIN_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    'SameSite=Lax'
  ].join('; '));
}

function renderLoginPage(errorMessage = '') {
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin Login</title><style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(135deg,#020617,#111827);color:#e2e8f0;font:16px system-ui}form{width:min(360px,calc(100% - 32px));padding:32px;border:1px solid #334155;border-radius:18px;background:#0f172a;box-shadow:0 20px 60px #0008}h1{margin:0 0 20px}input,button{width:100%;padding:12px 14px;border-radius:10px;border:1px solid #475569;font:inherit}input{margin:8px 0 16px;background:#020617;color:#e2e8f0}button{border:0;background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;font-weight:700;cursor:pointer}.error{color:#fca5a5}
  </style></head><body><form method="post" action="/api/admin/login"><h1>Portfolio Admin</h1>${errorMessage ? `<p class="error">${errorMessage}</p>` : ''}<label>Password<input type="password" name="password" required autofocus></label><button type="submit">Log in</button></form></body></html>`;
}

function parseTechStacks(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue.filter((item) => item && typeof item === 'object').map((item) => ({
      name: String(item.name || 'Skill').trim(),
      image: String(item.image || '').trim()
    })).filter((item) => item.name);
  }
  if (typeof rawValue !== 'string' || !rawValue.trim()) return DEFAULT_TECH_STACKS;
  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) return parseTechStacks(parsed);
  } catch {}
  return rawValue.split(/\r?\n/).map((line) => {
    const [name, ...image] = line.split('|');
    return { name: name.trim(), image: image.join('|').trim() };
  }).filter((item) => item.name);
}

function toDataUrl(file) {
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}

function publicProfile(profile) {
  return {
    name: profile.name,
    title: profile.title,
    description: profile.description,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    github: profile.github,
    cv: { fileName: profile.cv_file_name || '', url: profile.cv_url || '' }
  };
}

// --- Postgres-backed data access ------------------------------------------
// Every function below talks straight to Postgres so data survives across
// serverless invocations and deployments (unlike the old /tmp JSON file).

async function ensureSeed() {
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO profile (id, name, title, description, email, phone, location, github)
      VALUES (1, 'Natnael Zerihun', 'Frontend Developer',
        'I build responsive and user-friendly webpages using HTML, CSS and JavaScript with a focus on improving performance and creating better design.',
        'nathyzer21@gmail.com', '+251 967 323 308', 'Addis Ababa, Ethiopia', 'https://github.com/Nat-bit-ai')
      ON CONFLICT (id) DO NOTHING
    `);
    await client.query(`
      INSERT INTO homepage_settings (id, hero_image, tech_stacks)
      VALUES (1, '', $1::jsonb)
      ON CONFLICT (id) DO NOTHING
    `, [JSON.stringify(DEFAULT_TECH_STACKS)]);
    const { rows } = await client.query('SELECT COUNT(*)::int AS count FROM projects');
    if (rows[0].count === 0) {
      await client.query(`
        INSERT INTO projects (title, tag, description, image, link) VALUES
        ('E-Commerce App', 'E-Commerce', 'An online store with product browsing, cart management, and a smooth shopping experience on any device.', 'images/default-project.jpg', '#projects'),
        ('National Voting System', 'Gov Tech', 'A secure digital voting platform built for nationwide elections and easy voter access.', 'images/default-project.jpg', '#projects'),
        ('Portfolio Website', 'Portfolio', 'A personal portfolio that showcases my design approach, visual UI, and project storytelling.', 'images/default-project.jpg', '#projects')
      `);
    }
  } finally {
    client.release();
  }
}

async function getProfile() {
  const { rows } = await pool.query('SELECT * FROM profile WHERE id = 1');
  return rows[0];
}

async function getHomepage() {
  const { rows } = await pool.query('SELECT hero_image, tech_stacks FROM homepage_settings WHERE id = 1');
  const row = rows[0] || { hero_image: '', tech_stacks: DEFAULT_TECH_STACKS };
  return {
    heroImage: row.hero_image || '',
    techStacks: Array.isArray(row.tech_stacks) && row.tech_stacks.length ? row.tech_stacks : DEFAULT_TECH_STACKS
  };
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));
app.use('/images', express.static(path.join(rootDir, 'images')));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', storage: 'postgres', time: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'error', storage: 'postgres', detail: error.message });
  }
});

app.post('/api/admin/login', (req, res) => {
  if (!req.body?.password || req.body.password !== ADMIN_PASSWORD) {
    return res.status(401).send(renderLoginPage('Incorrect password.'));
  }
  setAdminCookie(res, signToken({ role: 'admin', exp: Date.now() + ADMIN_TOKEN_TTL_MS }), ADMIN_TOKEN_TTL_MS / 1000);
  return res.redirect('/admin');
});

app.post('/api/admin/logout', (req, res) => {
  setAdminCookie(res, '', 0);
  return res.redirect('/admin');
});

app.get('/api/admin/session', (req, res) => res.json({ authenticated: isAdminRequest(req) }));

app.get('/api/profile', async (req, res, next) => {
  try {
    res.json(publicProfile(await getProfile()));
  } catch (error) { next(error); }
});

app.get('/api/cv', async (req, res, next) => {
  try {
    const profile = await getProfile();
    res.json({ fileName: profile.cv_file_name || '', url: profile.cv_url || '' });
  } catch (error) { next(error); }
});

app.get('/api/projects', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM projects ORDER BY id');
    res.json(rows);
  } catch (error) { next(error); }
});

app.get('/api/homepage', async (req, res, next) => {
  try {
    res.json(await getHomepage());
  } catch (error) { next(error); }
});

app.put('/api/profile', requireAdmin, async (req, res, next) => {
  try {
    const current = await getProfile();
    const { rows } = await pool.query(
      `UPDATE profile SET name=$1, title=$2, description=$3, email=$4, phone=$5, location=$6, github=$7, updated_at=NOW()
       WHERE id = 1 RETURNING *`,
      [
        req.body.name ?? current.name,
        req.body.title ?? current.title,
        req.body.description ?? current.description,
        req.body.email ?? current.email,
        req.body.phone ?? current.phone,
        req.body.location ?? current.location,
        req.body.github ?? current.github
      ]
    );
    res.json(publicProfile(rows[0]));
  } catch (error) { next(error); }
});

app.post('/api/cv', requireAdmin, upload.single('cvFile'), async (req, res, next) => {
  try {
    const current = await getProfile();
    let fileName = current.cv_file_name;
    let url = current.cv_url;
    if (req.file) {
      fileName = req.file.originalname;
      url = toDataUrl(req.file);
    } else if (req.body?.fileName || req.body?.url) {
      fileName = req.body.fileName || fileName;
      url = req.body.url || url;
    }
    if (!url) return res.status(400).json({ error: 'No CV file uploaded.' });
    const { rows } = await pool.query(
      'UPDATE profile SET cv_file_name=$1, cv_url=$2, updated_at=NOW() WHERE id = 1 RETURNING cv_file_name, cv_url',
      [fileName, url]
    );
    res.json({ fileName: rows[0].cv_file_name, url: rows[0].cv_url });
  } catch (error) { next(error); }
});

app.post('/api/projects', requireAdmin, upload.single('projectImage'), async (req, res, next) => {
  if (!req.body?.title || !req.body?.description) {
    return res.status(400).json({ error: 'Title and description are required.' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO projects (title, tag, description, image, link)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        req.body.title,
        req.body.tag || 'General',
        req.body.description,
        req.file ? toDataUrl(req.file) : (req.body.image || 'images/default-project.jpg'),
        req.body.link || '#projects'
      ]
    );
    res.status(201).json(rows[0]);
  } catch (error) { next(error); }
});

app.put('/api/projects/:id', requireAdmin, upload.single('projectImage'), async (req, res, next) => {
  try {
    const { rows: existingRows } = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Project not found.' });
    const { rows } = await pool.query(
      `UPDATE projects SET title=$1, tag=$2, description=$3, image=$4, link=$5, updated_at=NOW()
       WHERE id = $6 RETURNING *`,
      [
        req.body.title || existing.title,
        req.body.tag || existing.tag,
        req.body.description || existing.description,
        req.file ? toDataUrl(req.file) : (req.body.image || existing.image),
        req.body.link || existing.link,
        req.params.id
      ]
    );
    res.json(rows[0]);
  } catch (error) { next(error); }
});

app.delete('/api/projects/:id', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING *', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Project not found.' });
    res.json({ message: 'Project deleted successfully.' });
  } catch (error) { next(error); }
});

app.put('/api/homepage', requireAdmin, upload.single('homepageImage'), async (req, res, next) => {
  try {
    const current = await getHomepage();
    const heroImage = req.file ? toDataUrl(req.file) : (req.body.heroImage || current.heroImage || '');
    const techStacks = parseTechStacks(req.body.techStacks || current.techStacks);
    await pool.query(
      `INSERT INTO homepage_settings (id, hero_image, tech_stacks, updated_at) VALUES (1, $1, $2::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET hero_image = EXCLUDED.hero_image, tech_stacks = EXCLUDED.tech_stacks, updated_at = NOW()`,
      [heroImage, JSON.stringify(techStacks)]
    );
    res.json({ heroImage, techStacks });
  } catch (error) { next(error); }
});

app.get('/api/messages', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM messages ORDER BY id DESC');
    res.json(rows);
  } catch (error) { next(error); }
});

app.post('/api/messages', async (req, res, next) => {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message) return res.status(400).json({ error: 'Name, email and message are required.' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO messages (name, email, message) VALUES ($1, $2, $3) RETURNING *',
      [name, email, message]
    );
    res.status(201).json(rows[0]);
  } catch (error) { next(error); }
});

app.delete('/api/messages/:id', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query('DELETE FROM messages WHERE id = $1 RETURNING *', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Message not found.' });
    res.json({ message: 'Message deleted successfully.' });
  } catch (error) { next(error); }
});

app.get('/admin', (req, res) => {
  if (!isAdminRequest(req)) return res.status(401).send(renderLoginPage());
  res.sendFile(path.join(publicDir, 'admin.html'));
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Route not found.' });
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: 'Internal server error.', detail: error.message });
});

ensureSeed().catch((error) => console.error('Seed check failed (will retry on next request):', error.message));

if (require.main === module) {
  // Only bind a port when run directly (npm start / node server.js).
  // On Vercel, @vercel/node imports this file as a module and calls the
  // exported app itself, so listening here is unnecessary and skipped.
  app.listen(PORT, () => {
    console.log(`Portfolio running at http://localhost:${PORT}`);
  });
}

module.exports = app;
