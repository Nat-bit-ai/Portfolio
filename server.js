require('dotenv').config();

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const rootDir = __dirname;
const uploadsDir = path.join(rootDir, 'uploads');

// Fail fast if the .env file is missing required values, instead of
// silently connecting with a hardcoded fallback password.
const REQUIRED_ENV_VARS = ['PGUSER', 'PGPASSWORD', 'PGDATABASE'];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variable(s): ${missingEnvVars.join(', ')}`);
  console.error('Copy .env.example to .env and fill in your local Postgres credentials.');
  process.exit(1);
}

const DB_NAME = process.env.PGDATABASE;

const adminPool = new Pool({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.ADMIN_DATABASE || 'postgres'
});

let pool;

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
    // Ignore invalid JSON and parse line-by-line below.
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

async function ensureDatabase() {
  const { rows } = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME]);

  if (rows.length === 0) {
    // Database names can't be parameterized, so this is validated against
    // the trusted .env value only - never against user input.
    await adminPool.query(`CREATE DATABASE "${DB_NAME}"`);
  }

  pool = new Pool({
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    database: DB_NAME
  });
}

async function query(sql, params = []) {
  if (!pool) {
    await ensureDatabase();
  }

  return pool.query(sql, params);
}

async function initializeDatabase() {
  await ensureDatabase();

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
      '5th Batch CTC Program Schedule for Development.pdf',
      '/5th Batch CTC Program Schedule for Development.pdf'
    ]);
  }

  const projectsCheck = await query('SELECT COUNT(*)::int AS count FROM projects');
  if (projectsCheck.rows[0].count === 0) {
    await query(`
      INSERT INTO projects (title, tag, description, image, link)
      VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10), ($11, $12, $13, $14, $15)
    `, [
      'National Voting System', 'Gov Tech', 'A secure digital voting platform built for nationwide elections and easy voter access.', 'images/Screenshot 2026-07-29 020836.png', '#projects',
      'Wardline Patient Portal', 'Healthcare', 'A patient portal interface for appointments, lab results, and secure medical communication.', 'images/Screenshot 2026-07-29 021550.png', '#projects',
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

function ensureUploadsDirectory() {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const cvStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname) || '.pdf';
    cb(null, `cv-${Date.now()}${extension}`);
  }
});

const projectStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname) || '.png';
    cb(null, `project-${Date.now()}${extension}`);
  }
});

const cvUpload = multer({
  storage: cvStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

const projectUpload = multer({
  storage: projectStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

const homepageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname) || '.png';
    cb(null, `homepage-${Date.now()}${extension}`);
  }
});

const homepageUpload = multer({
  storage: homepageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
ensureUploadsDirectory();
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(rootDir));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/profile', async (req, res) => {
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
});

app.put('/api/profile', async (req, res) => {
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
});

app.get('/api/cv', async (req, res) => {
  const result = await query('SELECT cv_file_name, cv_url FROM profile ORDER BY id DESC LIMIT 1');
  const profile = result.rows[0];

  if (!profile) {
    return res.json({ fileName: '', url: '' });
  }

  return res.json({
    fileName: profile.cv_file_name || '',
    url: profile.cv_url || ''
  });
});

app.post('/api/cv', cvUpload.single('cvFile'), async (req, res) => {
  const uploaded = req.file;

  if (uploaded) {
    const updated = await query(`
      UPDATE profile
      SET cv_file_name = $1,
          cv_url = $2,
          updated_at = NOW()
      WHERE id = (SELECT id FROM profile ORDER BY id DESC LIMIT 1)
      RETURNING cv_file_name, cv_url
    `, [uploaded.originalname, `/uploads/${uploaded.filename}`]);

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
});

app.get('/api/projects', async (req, res) => {
  const result = await query('SELECT * FROM projects ORDER BY created_at DESC');
  res.json(result.rows);
});

app.post('/api/projects', projectUpload.single('projectImage'), async (req, res) => {
  const payload = req.file ? { ...req.body, image: `/uploads/${req.file.filename}` } : req.body;
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
});

app.put('/api/projects/:id', projectUpload.single('projectImage'), async (req, res) => {
  const existing = await query('SELECT * FROM projects WHERE id = $1', [req.params.id]);

  if (existing.rowCount === 0) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  const payload = req.file ? { ...req.body, image: `/uploads/${req.file.filename}` } : req.body;
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
});

app.delete('/api/projects/:id', async (req, res) => {
  const result = await query('DELETE FROM projects WHERE id = $1 RETURNING *', [req.params.id]);

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  return res.json({ message: 'Project deleted successfully.' });
});

app.get('/api/homepage', async (req, res) => {
  const result = await query('SELECT value FROM site_settings WHERE key = $1', ['homepage']);
  const homepage = result.rowCount > 0 ? result.rows[0].value : DEFAULT_HOMEPAGE_SETTINGS;

  res.json({
    heroImage: homepage.heroImage || DEFAULT_HOMEPAGE_SETTINGS.heroImage,
    techStacks: Array.isArray(homepage.techStacks) && homepage.techStacks.length
      ? homepage.techStacks
      : DEFAULT_HOMEPAGE_SETTINGS.techStacks
  });
});

app.put('/api/homepage', homepageUpload.single('homepageImage'), async (req, res) => {
  const existing = await query('SELECT value FROM site_settings WHERE key = $1', ['homepage']);
  const current = existing.rowCount > 0 ? existing.rows[0].value : DEFAULT_HOMEPAGE_SETTINGS;

  const payload = {
    heroImage: req.file ? `/uploads/${req.file.filename}` : (req.body.heroImage || current.heroImage || DEFAULT_HOMEPAGE_SETTINGS.heroImage),
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
});

app.get('/api/messages', async (req, res) => {
  const result = await query('SELECT * FROM messages ORDER BY created_at DESC');
  res.json(result.rows);
});

app.post('/api/messages', async (req, res) => {
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
});

app.delete('/api/messages/:id', async (req, res) => {
  const result = await query('DELETE FROM messages WHERE id = $1 RETURNING *', [req.params.id]);

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Message not found.' });
  }

  return res.json({ message: 'Message deleted successfully.' });
});

app.get('/admin', (req, res) => {
  return res.sendFile(path.join(rootDir, 'admin.html'));
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Route not found.' });
  }

  return res.sendFile(path.join(rootDir, 'index.html'));
});

async function startServer() {
  try {
    await initializeDatabase();
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
  } catch (error) {
    console.error('Failed to initialize PostgreSQL database:', error.message);
    process.exit(1);
  }
}

startServer();