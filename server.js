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

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const rootDir = __dirname;
const publicDir = path.join(rootDir, 'public');
// Vercel's deployed filesystem is read-only except /tmp. Writing to the
// bundled `data/` folder throws EROFS in production, so fall back to /tmp
// there. NOTE: /tmp is wiped between cold starts/deployments, so edits made
// through /admin will NOT persist on Vercel until this is backed by a real
// database (e.g. Postgres, per database.sql) or a storage service.
const writableRoot = process.env.VERCEL ? '/tmp' : rootDir;
const dataDir = path.join(writableRoot, 'data');
const storageFile = process.env.STORAGE_FILE
  ? path.resolve(writableRoot, process.env.STORAGE_FILE)
  : path.join(dataDir, 'store.json');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '@Nathy1821';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'change-this-admin-secret';
const ADMIN_COOKIE = 'admin_token';
const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

const DEFAULT_HOMEPAGE_SETTINGS = {
  heroImage: '',
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

function now() {
  return new Date().toISOString();
}

function defaultStore() {
  const timestamp = now();
  return {
    profile: {
      id: 1,
      name: 'Natnael Zerihun',
      title: 'Frontend Developer',
      description: 'I build responsive and user-friendly webpages using HTML, CSS and JavaScript with a focus on improving performance and creating better design.',
      email: 'nathyzer21@gmail.com',
      phone: '+251 967 323 308',
      location: 'Addis Ababa, Ethiopia',
      github: 'https://github.com/Nat-bit-ai',
      cv_file_name: '',
      cv_url: '',
      created_at: timestamp,
      updated_at: timestamp
    },
    projects: [
      {
        id: 1,
        title: 'E-Commerce App',
        tag: 'E-Commerce',
        description: 'An online store with product browsing, cart management, and a smooth shopping experience on any device.',
        image: 'images/default-project.jpg',
        link: '#projects',
        created_at: timestamp,
        updated_at: timestamp
      },
      {
        id: 2,
        title: 'National Voting System',
        tag: 'Gov Tech',
        description: 'A secure digital voting platform built for nationwide elections and easy voter access.',
        image: 'images/default-project.jpg',
        link: '#projects',
        created_at: timestamp,
        updated_at: timestamp
      },
      {
        id: 3,
        title: 'Portfolio Website',
        tag: 'Portfolio',
        description: 'A personal portfolio that showcases my design approach, visual UI, and project storytelling.',
        image: 'images/default-project.jpg',
        link: '#projects',
        created_at: timestamp,
        updated_at: timestamp
      }
    ],
    homepage: DEFAULT_HOMEPAGE_SETTINGS,
    messages: [],
    nextIds: { project: 4, message: 1 }
  };
}

function ensureStore() {
  fs.mkdirSync(path.dirname(storageFile), { recursive: true });
  if (fs.existsSync(storageFile)) return;
  // On Vercel, storageFile lives under /tmp and starts empty on every cold
  // start. Seed it from the bundled data/store.json (included via
  // vercel.json -> includeFiles) so real content shows up instead of the
  // hardcoded defaults. Remember: /tmp doesn't persist edits between
  // invocations/deployments — see the writableRoot comment above.
  const bundledSeed = path.join(rootDir, 'data', 'store.json');
  if (bundledSeed !== storageFile && fs.existsSync(bundledSeed)) {
    fs.copyFileSync(bundledSeed, storageFile);
    return;
  }
  writeStore(defaultStore());
}

function readStore() {
  ensureStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(storageFile, 'utf8'));
    const seeded = defaultStore();
    return {
      ...seeded,
      ...parsed,
      profile: { ...seeded.profile, ...(parsed.profile || {}) },
      homepage: { ...seeded.homepage, ...(parsed.homepage || {}) },
      projects: Array.isArray(parsed.projects) ? parsed.projects : seeded.projects,
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      nextIds: { ...seeded.nextIds, ...(parsed.nextIds || {}) }
    };
  } catch (error) {
    console.error(`Could not read ${storageFile}; restoring defaults:`, error.message);
    const fresh = defaultStore();
    writeStore(fresh);
    return fresh;
  }
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(storageFile), { recursive: true });
  const temporaryFile = `${storageFile}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(store, null, 2));
  fs.renameSync(temporaryFile, storageFile);
}

function updateStore(mutator) {
  const store = readStore();
  const result = mutator(store);
  writeStore(store);
  return result;
}

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
  if (typeof rawValue !== 'string' || !rawValue.trim()) return DEFAULT_HOMEPAGE_SETTINGS.techStacks;
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

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));
app.use('/images', express.static(path.join(rootDir, 'images')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', storage: 'local-json', time: now() });
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

app.get('/api/profile', (req, res) => res.json(publicProfile(readStore().profile)));

app.get('/api/cv', (req, res) => {
  const profile = readStore().profile;
  res.json({ fileName: profile.cv_file_name || '', url: profile.cv_url || '' });
});

app.get('/api/projects', (req, res) => res.json(readStore().projects));

app.get('/api/homepage', (req, res) => {
  const homepage = readStore().homepage;
  res.json({
    heroImage: homepage.heroImage || '',
    techStacks: Array.isArray(homepage.techStacks) && homepage.techStacks.length
      ? homepage.techStacks : DEFAULT_HOMEPAGE_SETTINGS.techStacks
  });
});

app.put('/api/profile', requireAdmin, (req, res) => {
  const updated = updateStore((store) => {
    store.profile = {
      ...store.profile,
      name: req.body.name ?? store.profile.name,
      title: req.body.title ?? store.profile.title,
      description: req.body.description ?? store.profile.description,
      email: req.body.email ?? store.profile.email,
      phone: req.body.phone ?? store.profile.phone,
      location: req.body.location ?? store.profile.location,
      github: req.body.github ?? store.profile.github,
      updated_at: now()
    };
    return store.profile;
  });
  res.json(publicProfile(updated));
});

app.post('/api/cv', requireAdmin, upload.single('cvFile'), (req, res) => {
  const updated = updateStore((store) => {
    if (req.file) {
      store.profile.cv_file_name = req.file.originalname;
      store.profile.cv_url = toDataUrl(req.file);
    } else if (req.body?.fileName || req.body?.url) {
      store.profile.cv_file_name = req.body.fileName || store.profile.cv_file_name;
      store.profile.cv_url = req.body.url || store.profile.cv_url;
    }
    store.profile.updated_at = now();
    return store.profile;
  });
  if (!updated.cv_url) return res.status(400).json({ error: 'No CV file uploaded.' });
  res.json({ fileName: updated.cv_file_name, url: updated.cv_url });
});

app.post('/api/projects', requireAdmin, upload.single('projectImage'), (req, res) => {
  if (!req.body?.title || !req.body?.description) {
    return res.status(400).json({ error: 'Title and description are required.' });
  }
  const project = updateStore((store) => {
    const timestamp = now();
    const item = {
      id: store.nextIds.project++,
      title: req.body.title,
      tag: req.body.tag || 'General',
      description: req.body.description,
      image: req.file ? toDataUrl(req.file) : (req.body.image || 'images/default-project.jpg'),
      link: req.body.link || '#projects',
      created_at: timestamp,
      updated_at: timestamp
    };
    store.projects.push(item);
    return item;
  });
  res.status(201).json(project);
});

app.put('/api/projects/:id', requireAdmin, upload.single('projectImage'), (req, res) => {
  const project = updateStore((store) => {
    const item = store.projects.find((entry) => String(entry.id) === String(req.params.id));
    if (!item) return null;
    item.title = req.body.title || item.title;
    item.tag = req.body.tag || item.tag;
    item.description = req.body.description || item.description;
    item.image = req.file ? toDataUrl(req.file) : (req.body.image || item.image);
    item.link = req.body.link || item.link;
    item.updated_at = now();
    return item;
  });
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  res.json(project);
});

app.delete('/api/projects/:id', requireAdmin, (req, res) => {
  const deleted = updateStore((store) => {
    const index = store.projects.findIndex((entry) => String(entry.id) === String(req.params.id));
    return index === -1 ? null : store.projects.splice(index, 1)[0];
  });
  if (!deleted) return res.status(404).json({ error: 'Project not found.' });
  res.json({ message: 'Project deleted successfully.' });
});

app.put('/api/homepage', requireAdmin, upload.single('homepageImage'), (req, res) => {
  const homepage = updateStore((store) => {
    store.homepage = {
      ...store.homepage,
      heroImage: req.file ? toDataUrl(req.file) : (req.body.heroImage || store.homepage.heroImage || ''),
      techStacks: parseTechStacks(req.body.techStacks || store.homepage.techStacks)
    };
    return store.homepage;
  });
  res.json(homepage);
});

app.get('/api/messages', requireAdmin, (req, res) => res.json(readStore().messages.slice().reverse()));

app.post('/api/messages', (req, res) => {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message) return res.status(400).json({ error: 'Name, email and message are required.' });
  const created = updateStore((store) => {
    const item = { id: store.nextIds.message++, name, email, message, created_at: now() };
    store.messages.push(item);
    return item;
  });
  res.status(201).json(created);
});

app.delete('/api/messages/:id', requireAdmin, (req, res) => {
  const deleted = updateStore((store) => {
    const index = store.messages.findIndex((entry) => String(entry.id) === String(req.params.id));
    return index === -1 ? null : store.messages.splice(index, 1)[0];
  });
  if (!deleted) return res.status(404).json({ error: 'Message not found.' });
  res.json({ message: 'Message deleted successfully.' });
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

ensureStore();
if (require.main === module) {
  // Only bind a port when run directly (npm start / node server.js).
  // On Vercel, @vercel/node imports this file as a module and calls the
  // exported app itself, so listening here is unnecessary and skipped.
  app.listen(PORT, () => {
    console.log(`Portfolio running at http://localhost:${PORT}`);
    console.log(`Local data store: ${storageFile}`);
  });
}

module.exports = app;