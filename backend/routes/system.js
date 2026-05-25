const express  = require('express');
const { exec } = require('child_process');
const os       = require('os');
const fs       = require('fs');
const router   = express.Router();

const { loadServers, getMetrics: getRemoteMetrics, sshExec } = require('../services/servers');

// ── Modo de métricas ─────────────────────────────────────────────
// METRICS_MODE=local  → siempre local (útil cuando está deployado en el VPS)
// METRICS_MODE=ssh    → siempre SSH al SERVER_1
// Sin valor           → auto: SSH si no corre en Linux, local si sí
function useSSH() {
  const mode = process.env.METRICS_MODE;
  if (mode === 'local') return false;
  if (mode === 'ssh')   return true;
  return os.platform() !== 'linux'; // auto-detect
}

// ── Métricas locales ─────────────────────────────────────────────

function getCpuPct() {
  return new Promise((resolve) => {
    try {
      const raw1 = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0];
      const v1   = raw1.trim().split(/\s+/).slice(1).map(Number);
      setTimeout(() => {
        try {
          const raw2 = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0];
          const v2   = raw2.trim().split(/\s+/).slice(1).map(Number);
          const total = v2.reduce((a, b) => a + b, 0) - v1.reduce((a, b) => a + b, 0);
          const idle  = (v2[3] + (v2[4] || 0)) - (v1[3] + (v1[4] || 0));
          resolve(total === 0 ? 0 : Math.min(100, Math.round(((total - idle) / total) * 100)));
        } catch { resolve(0); }
      }, 200);
    } catch {
      resolve(Math.min(100, Math.round((os.loadavg()[0] / os.cpus().length) * 100)));
    }
  });
}

function getDisk() {
  return new Promise((resolve) => {
    exec("df -BM / | awk 'NR==2{print $2,$3,$4}'", (err, stdout) => {
      if (err || !stdout.trim()) return resolve(null);
      const [total, used, free] = stdout.trim().split(' ').map((v) => parseInt(v));
      resolve({ total, used, free, pct: Math.round((used / total) * 100) });
    });
  });
}

async function getLocalMetrics() {
  const totalMem = os.totalmem();
  const freeMem  = os.freemem();
  const usedMem  = totalMem - freeMem;
  const loadAvg  = os.loadavg();
  const cpuCount = os.cpus().length;

  const [cpuPct, disk] = await Promise.all([getCpuPct(), getDisk()]);

  return {
    cpu:  { pct: cpuPct, load: loadAvg, cores: cpuCount },
    ram:  {
      total: Math.round(totalMem / 1024 / 1024),
      used:  Math.round(usedMem  / 1024 / 1024),
      free:  Math.round(freeMem  / 1024 / 1024),
      pct:   Math.round((usedMem / totalMem) * 100),
    },
    disk,
    uptime:   os.uptime(),
    hostname: os.hostname(),
    platform: os.platform(),
    source:   'local',
  };
}

// ── Función unificada ────────────────────────────────────────────
async function resolveMetrics() {
  if (useSSH()) {
    const servers = loadServers();
    if (!servers.length) return getLocalMetrics(); // fallback si no hay SERVER_1
    const metrics = await getRemoteMetrics(servers[0]);
    return { ...metrics, source: 'ssh' };
  }
  return getLocalMetrics();
}

// ── History buffer ───────────────────────────────────────────────
const HISTORY_MAX = 60;
const metricsHistory = [];

async function collectAndStore() {
  try {
    const m = await resolveMetrics();
    metricsHistory.push({
      timestamp: new Date().toISOString(),
      cpu:    m.cpu.pct,
      ram:    m.ram.pct,
      disk:   m.disk ? m.disk.pct : null,
    });
    if (metricsHistory.length > HISTORY_MAX) metricsHistory.shift();
  } catch { /* no romper el intervalo si SSH falla */ }
}

collectAndStore();
setInterval(collectAndStore, 10000);

// ── Routes ───────────────────────────────────────────────────────

router.get('/metrics', async (req, res) => {
  try {
    res.json(await resolveMetrics());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/metrics/history', (req, res) => {
  res.json(metricsHistory);
});

// Indica si las métricas vienen por SSH o local
// ── Helper: ejecutar comando local o via SSH ─────────────────────
function runCmd(command, timeout = 15000) {
  if (useSSH()) {
    const servers = loadServers();
    if (!servers.length) return Promise.reject(new Error('No hay SERVER_1 configurado'));
    return sshExec(servers[0], command, timeout);
  }
  return new Promise((resolve, reject) => {
    exec(command, { timeout }, (err, stdout) => {
      if (err && !stdout) return reject(err);
      resolve(stdout.trim());
    });
  });
}

// ── Top procesos ─────────────────────────────────────────────────
router.get('/processes', async (req, res) => {
  try {
    const out = await runCmd(
      "ps aux --sort=-%cpu | awk 'NR==1{next} NR<=21{printf \"%s|%s|%s|%s|%s|%s\\n\",$1,$2,$3,$4,$8,$11}'"
    );
    const processes = out.split('\n').filter(Boolean).map((line) => {
      const [user, pid, cpu, mem, stat, ...cmdParts] = line.split('|');
      return { user, pid, cpu: parseFloat(cpu), mem: parseFloat(mem), stat, cmd: cmdParts.join(' ') };
    });
    res.json(processes);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Disk breakdown por directorio ────────────────────────────────
router.get('/disk-breakdown', async (req, res) => {
  try {
    const dir = process.env.DISK_BREAKDOWN_DIR || '/var/www';
    const out = await runCmd(`du -sh ${dir}/* 2>/dev/null | sort -rh | head -30`);
    const entries = out.split('\n').filter(Boolean).map((line) => {
      const [size, ...pathParts] = line.split('\t');
      const path = pathParts.join('\t');
      const name = path.split('/').pop() || path;
      return { size, path, name };
    });
    res.json({ dir, entries });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/metrics/source', (req, res) => {
  const sshMode = useSSH();
  const servers = loadServers();
  res.json({
    mode:   sshMode ? 'ssh' : 'local',
    server: sshMode && servers.length ? servers[0].name : null,
  });
});

// Actualizar paquetes del VPS
router.post('/update', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.flushHeaders();

  const cmd  = 'DEBIAN_FRONTEND=noninteractive apt-get update -y && apt-get upgrade -y 2>&1';
  const proc = exec(cmd, { timeout: 300000 });

  proc.stdout?.on('data', (d) => res.write(d));
  proc.stderr?.on('data', (d) => res.write(d));
  proc.on('close', (code) => { res.write(`\n[Proceso terminado con código ${code}]\n`); res.end(); });
  proc.on('error', (err)  => { res.write(`\nError: ${err.message}\n`); res.end(); });
});

// Cambiar contraseña del dashboard
router.post('/change-password', async (req, res) => {
  const bcrypt = require('bcrypt');
  const path   = require('path');

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Faltan campos' });
  if (newPassword.length < 8)            return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) return res.status(500).json({ error: 'Servidor no configurado' });

  const valid = await bcrypt.compare(currentPassword, hash);
  if (!valid) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

  const newHash = await bcrypt.hash(newPassword, 10);

  const envPath = path.join(__dirname, '../../.env');
  let content   = fs.readFileSync(envPath, 'utf8');
  content       = content.replace(/ADMIN_PASSWORD_HASH=.*/, `ADMIN_PASSWORD_HASH=${newHash}`);
  fs.writeFileSync(envPath, content);

  process.env.ADMIN_PASSWORD_HASH = newHash;
  res.json({ ok: true });
});

module.exports = router;
