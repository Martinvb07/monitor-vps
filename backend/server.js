require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { WebSocketServer } = require('ws');
const http = require('http');
const jwt = require('jsonwebtoken');
const authMiddleware = require('./middleware/auth');
const monitor = require('./services/monitor');

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
    },
  },
}));

app.use(cors({
  origin: [
    process.env.ALLOWED_ORIGIN || 'http://localhost:3001',
    'http://localhost:3001',
    'http://localhost:3000',
  ],
  credentials: true,
}));

app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

app.use('/api/auth', require('./routes/auth'));

app.use('/api/', authMiddleware);
app.use('/api', require('./routes/status'));
app.use('/api/alertas', require('./routes/alertas'));
app.use('/api/visitantes', require('./routes/visitantes'));
app.use('/api/deploys', require('./routes/deploys'));
app.use('/api/seguridad', require('./routes/seguridad'));
app.use('/api/pm2',     require('./routes/pm2'));
app.use('/api/sites',   require('./routes/sites'));
app.use('/api/notes',   require('./routes/notes'));
app.use('/api/logs',    require('./routes/logs'));
app.use('/api/ports',   require('./routes/ports'));
app.use('/webhook',     require('./routes/webhook'));
app.use('/api/system',   require('./routes/system'));
app.use('/api/servers',  require('./routes/servers'));
app.use('/api/push',     require('./routes/push'));
app.use('/api/envfiles',  require('./routes/envfiles'));
app.use('/api/nginx',     require('./routes/nginx'));
app.use('/api/snippets',  require('./routes/snippets'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT    = process.env.PORT    || 3000;
const WS_PORT = process.env.WS_PORT || 3003;

app.listen(PORT, () => {
  console.log(`MartinHQ API en http://localhost:${PORT}`);
  monitor.start();
});

// ── WebSocket real-time status ──────────────────
const wsServer = http.createServer();
const wss = new WebSocketServer({ server: wsServer });

wss.on('connection', (ws, req) => {
  const token = new URL(req.url, 'http://x').searchParams.get('token');
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    ws.close(1008, 'Unauthorized');
    return;
  }

  // Enviar estado actual inmediatamente al conectar
  const current = { type: 'update', sites: monitor.getLatest(), alerts: monitor.getAlerts() };
  ws.send(JSON.stringify(current));

  ws.on('error', () => ws.close());
});

// Broadcast + push notifications cuando un sitio cae
const { sendPush } = require('./routes/push');
const downTracker = new Set();

monitor.emitter.on('update', ({ sites, alerts }) => {
  const msg = JSON.stringify({ type: 'update', sites, alerts });
  wss.clients.forEach((ws) => { if (ws.readyState === ws.OPEN) ws.send(msg); });

  sites.forEach((s) => {
    if (!s.online && !downTracker.has(s.id)) {
      downTracker.add(s.id);
      sendPush(`⚠ ${s.nombre} caído`, `HTTP ${s.status || 0} · ${s.url}`, { url: '/' });
    } else if (s.online && downTracker.has(s.id)) {
      downTracker.delete(s.id);
      sendPush(`✓ ${s.nombre} recuperado`, `Volvió a responder correctamente`);
    }
  });
});

wsServer.listen(WS_PORT, () => {
  console.log(`MartinHQ WS en ws://localhost:${WS_PORT}`);
});
