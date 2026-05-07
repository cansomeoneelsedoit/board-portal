const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fileUpload = require('express-fileupload');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(fileUpload({ useTempFiles: false }));

// Upload dir
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Serve uploads
app.use('/uploads', express.static(UPLOAD_DIR));

// Current user middleware (no auth for MVP)
app.use((req, res, next) => {
  req.userId = req.headers['x-user-id'] || null;
  next();
});

// Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/boards', require('./routes/boards'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/agenda', require('./routes/agenda'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/motions', require('./routes/motions'));
app.use('/api/votes', require('./routes/votes'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/minutes', require('./routes/minutes'));
app.use('/api/coi', require('./routes/coi'));
app.use('/api/proxies', require('./routes/proxies'));
app.use('/api/integrations', require('./routes/integrations'));
app.use('/api/audit', require('./routes/audit'));

// Root
app.get('/', (req, res) => res.json({ message: 'Board Portal API', status: 'running' }));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('Board Portal API running on port ' + PORT);
});

module.exports = { app, prisma };
