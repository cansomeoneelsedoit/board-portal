const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fileUpload = require('express-fileupload');
const prisma = require('./lib/prisma');

const app = express();

// Mount prefix. Standalone this is /api; embedded in a MasonsView/HotelView
// vertical the host routes a sub-path here (e.g. /board-portal/api).
const API_PREFIX = process.env.API_PREFIX || '/api';

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '5mb' }));
app.use(fileUpload({ useTempFiles: false, limits: { fileSize: 50 * 1024 * 1024 } }));

// Upload dir
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

// Current user middleware.
// No authentication in standalone mode — the host vertical is expected to
// authenticate and forward the identity as x-user-id.
app.use((req, res, next) => {
  req.userId = req.headers['x-user-id'] || null;
  req.orgKey = req.headers['x-org-key'] || null;
  next();
});

// Routes
const api = express.Router();
api.use('/dashboard', require('./routes/dashboard'));
api.use('/users', require('./routes/users'));
api.use('/boards', require('./routes/boards'));
api.use('/meetings', require('./routes/meetings'));
api.use('/agenda', require('./routes/agenda'));
api.use('/documents', require('./routes/documents'));
api.use('/motions', require('./routes/motions'));
api.use('/votes', require('./routes/votes'));
api.use('/attendance', require('./routes/attendance'));
api.use('/minutes', require('./routes/minutes'));
api.use('/coi', require('./routes/coi'));
api.use('/proxies', require('./routes/proxies'));
api.use('/integrations', require('./routes/integrations'));
api.use('/audit', require('./routes/audit'));
app.use(API_PREFIX, api);

// Health check — used by Railway and by the SPA's connection banner.
const health = async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'up', timestamp: new Date() });
  } catch (e) {
    res.status(503).json({ status: 'degraded', database: 'down', error: e.message });
  }
};
app.get('/health', health);
app.get(`${API_PREFIX}/health`, health);

// Root
app.get('/', (req, res) =>
  res.json({ message: 'Board Portal API', status: 'running', apiPrefix: API_PREFIX })
);

// Optionally serve the built SPA from this same service (single-service deploys
// and the embedded-module case). Off by default: Railway runs a separate
// board-portal-frontend service.
if (process.env.SERVE_SPA === '1') {
  const dist = process.env.SPA_DIST || path.join(__dirname, '..', '..', 'frontend', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^(?!\/api|\/health|\/uploads).*/, (req, res) =>
      res.sendFile(path.join(dist, 'index.html'))
    );
    console.log(`Serving SPA from ${dist}`);
  } else {
    console.warn(`SERVE_SPA=1 but no build at ${dist}`);
  }
}

// 404 for unmatched API routes
app.use((req, res) => res.status(404).json({ error: 'Not found', path: req.path }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3013;

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Board Portal API running on port ${PORT} (prefix ${API_PREFIX})`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { app, prisma };
