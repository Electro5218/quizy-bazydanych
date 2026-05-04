require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db/pool');

const authRouter      = require('./routes/auth');
const usersRouter     = require('./routes/users');
const groupsRouter    = require('./routes/groups');
const quizzesRouter   = require('./routes/quizzes');
const questionsRouter = require('./routes/questions');
const attemptsRouter  = require('./routes/attempts');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logowanie requestów w trybie dev
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// ============================================================
// ROUTES
// ============================================================
app.use('/api/auth',      authRouter);
app.use('/api/users',     usersRouter);
app.use('/api/groups',    groupsRouter);
app.use('/api/quizzes',   quizzesRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/attempts',  attemptsRouter);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Endpoint ${req.method} ${req.path} nie istnieje` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Nieobsłużony błąd:', err);
  res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
});

// ============================================================
// START
// ============================================================
app.listen(PORT, () => {
  console.log(`\n🚀 Backend quizów uruchomiony na http://localhost:${PORT}`);
  console.log(`📋 API dostępne pod: http://localhost:${PORT}/api`);
  console.log(`🏥 Health check:     http://localhost:${PORT}/api/health`);
  console.log(`🌐 Frontend URL:     ${process.env.FRONTEND_URL || 'http://localhost:5173'}\n`);
});

module.exports = app;
