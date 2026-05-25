const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const { exec } = require('child_process');
const { loadServers, sshExec, sshPipeToFile } = require('../services/servers');

const router = express.Router();

// ── Config persistente ───────────────────────────────────────────
const CONFIG_FILE = path.join(__dirname, '../data/backup-config.json');

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; }
}
function saveConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function getBackupDir() {
  const cfg = loadConfig();
  if (cfg.backupDir) return cfg.backupDir;
  if (process.env.BACKUP_LOCAL_DIR) return path.resolve(process.env.BACKUP_LOCAL_DIR);
  return path.join(__dirname, '../backups');
}

// ── SSH auto-detect ──────────────────────────────────────────────
function useSSH() {
  const mode = process.env.METRICS_MODE;
  if (mode === 'local') return false;
  if (mode === 'ssh')   return true;
  return os.platform() !== 'linux';
}

function getServer() {
  return loadServers()[0] || null;
}

function fmtBytes(bytes) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024)       return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// ── Detección de bases de datos ──────────────────────────────────
const DETECT_CMD = [
  'MYSQL=0; (mysqladmin ping 2>/dev/null | grep -q alive) && MYSQL=1; echo "mysql=$MYSQL"',
  'MONGO=0; (pgrep -x mongod > /dev/null 2>&1 || pgrep -x mongodb > /dev/null 2>&1) && MONGO=1; echo "mongo=$MONGO"',
  'PG=0; (pg_isready 2>/dev/null | grep -q "accepting") && PG=1; echo "postgres=$PG"',
].join(' && ');

async function detectDatabases() {
  let out = '';
  try {
    if (useSSH()) {
      const srv = getServer();
      if (!srv) return { mysql: false, mongo: false, postgres: false };
      out = await sshExec(srv, DETECT_CMD, 10000);
    } else {
      out = await new Promise((res) => exec(DETECT_CMD, { timeout: 10000 }, (_, stdout) => res(stdout || '')));
    }
  } catch { /* sin DB */ }
  return {
    mysql:    /mysql=1/.test(out),
    mongo:    /mongo=1/.test(out),
    postgres: /postgres=1/.test(out),
  };
}

// ── Backup via SSH → pipe local ──────────────────────────────────
async function runComponentSSH(srv, command, localFile, send) {
  const ws = fs.createWriteStream(localFile);
  try {
    await sshPipeToFile(srv, command, ws, (e) => send && send(e));
    const size = fs.existsSync(localFile) ? fs.statSync(localFile).size : 0;
    return { ok: true, size };
  } catch (e) {
    if (fs.existsSync(localFile)) fs.unlinkSync(localFile);
    return { ok: false, error: e.message };
  }
}

function runComponentLocal(command, localFile) {
  return new Promise((resolve) => {
    const proc = exec(`${command} > "${localFile}"`, { timeout: 600000 });
    proc.on('close', (code) => {
      const size = fs.existsSync(localFile) ? fs.statSync(localFile).size : 0;
      resolve(code === 0 ? { ok: true, size } : { ok: false, error: `Exit ${code}` });
    });
    proc.on('error', (e) => resolve({ ok: false, error: e.message }));
  });
}

// ── Routes ───────────────────────────────────────────────────────

// Config: leer y guardar directorio de backup
router.get('/config', (req, res) => {
  res.json({ backupDir: getBackupDir() });
});

router.post('/config', (req, res) => {
  const { backupDir } = req.body;
  if (!backupDir || typeof backupDir !== 'string') return res.status(400).json({ error: 'backupDir requerido' });
  try {
    fs.mkdirSync(backupDir, { recursive: true });
    saveConfig({ backupDir });
    res.json({ ok: true, backupDir });
  } catch (e) {
    res.status(400).json({ error: `No se pudo crear el directorio: ${e.message}` });
  }
});

// Detección de DBs instaladas
router.get('/detect', async (req, res) => {
  try {
    const dbs = await detectDatabases();
    const srv = useSSH() ? getServer() : null;
    res.json({ ...dbs, nginx: true, www: true, host: srv?.name || os.hostname() });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Lista de backups guardados localmente
router.get('/', (req, res) => {
  const BACKUP_DIR = getBackupDir();
  try {
    if (!fs.existsSync(BACKUP_DIR)) return res.json({ backupDir: BACKUP_DIR, backups: [] });

    const entries = fs.readdirSync(BACKUP_DIR, { withFileTypes: true })
      .filter((d) => {
        if (!d.isDirectory()) return false;
        try { return JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, d.name, 'manifest.json'), 'utf8'))._mhq === true; }
        catch { return false; }
      })
      .map((d) => {
        const dir = path.join(BACKUP_DIR, d.name);
        const manifestPath = path.join(dir, 'manifest.json');
        let manifest = {};
        try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch {}

        const files = fs.readdirSync(dir).filter((f) => f !== 'manifest.json').map((f) => {
          const stat = fs.statSync(path.join(dir, f));
          return { name: f, size: stat.size, sizeHuman: fmtBytes(stat.size) };
        });

        const totalSize = files.reduce((a, f) => a + f.size, 0);
        return {
          id: d.name,
          timestamp: manifest.timestamp || d.name,
          host: manifest.host || '—',
          source: manifest.source || 'local',
          components: manifest.components || {},
          files,
          totalSize,
          totalSizeHuman: fmtBytes(totalSize),
        };
      })
      .sort((a, b) => b.id.localeCompare(a.id));

    res.json({ backupDir: BACKUP_DIR, backups: entries });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ejecutar backup (streaming, con selección de tipos)
router.post('/run', async (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.flushHeaders();

  const send = (msg) => { if (!res.writableEnded) res.write(msg); };

  try {
    const types = Array.isArray(req.body?.types) && req.body.types.length
      ? req.body.types
      : ['mysql', 'mongo', 'postgres', 'nginx', 'www'];

    const BACKUP_DIR = getBackupDir();
    const id      = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const destDir = path.join(BACKUP_DIR, id);
    fs.mkdirSync(destDir, { recursive: true });

    const ssh  = useSSH();
    const srv  = ssh ? getServer() : null;
    const host = srv?.name || os.hostname();

    send(`[MARTIN.HQ] Backup iniciado — ${new Date().toLocaleString('es-CO')}\n`);
    send(`[INFO] Destino: ${destDir}\n`);
    send(`[INFO] Fuente: ${ssh ? `SSH → ${host}` : 'local'}\n`);
    send(`[INFO] Componentes: ${types.join(', ')}\n\n`);

    const manifest = { _mhq: true, timestamp: new Date().toISOString(), source: ssh ? 'ssh' : 'local', host, components: {} };

    const dbs = await detectDatabases().catch(() => ({ mysql: false, mongo: false, postgres: false }));

    async function step(label, file, sshCmd) {
      send(`[STEP] ${label}...\n`);
      const localPath = path.join(destDir, file);
      const result = (ssh && srv)
        ? await runComponentSSH(srv, sshCmd, localPath, (e) => send(`       ${e}`))
        : await runComponentLocal(sshCmd, localPath);
      if (result.ok) send(`[OK]   ${label} → ${fmtBytes(result.size)}\n`);
      else send(`[WARN] ${label} falló: ${result.error}\n`);
      return result;
    }

    if (types.includes('mysql') && dbs.mysql) {
      const r = await step('MySQL', 'mysql.sql.gz', 'mysqldump --all-databases --single-transaction --quick 2>/dev/null | gzip');
      manifest.components.mysql = { file: 'mysql.sql.gz', size: r.size || 0, ok: r.ok };
    }
    if (types.includes('mongo') && dbs.mongo) {
      const r = await step('MongoDB', 'mongodb.gz', 'mongodump --archive --gzip 2>/dev/null');
      manifest.components.mongo = { file: 'mongodb.gz', size: r.size || 0, ok: r.ok };
    }
    if (types.includes('postgres') && dbs.postgres) {
      const r = await step('PostgreSQL', 'postgres.sql.gz', 'sudo -u postgres pg_dumpall 2>/dev/null | gzip');
      manifest.components.postgres = { file: 'postgres.sql.gz', size: r.size || 0, ok: r.ok };
    }
    if (types.includes('nginx')) {
      const r = await step('Nginx — /etc/nginx/', 'nginx.tar.gz', 'tar -czf - /etc/nginx/ 2>/dev/null; true');
      manifest.components.nginx = { file: 'nginx.tar.gz', size: r.size || 0, ok: r.ok };
    }
    if (types.includes('www')) {
      const r = await step('Sitios — /var/www/', 'www.tar.gz', 'tar -czf - /var/www/ 2>/dev/null; true');
      manifest.components.www = { file: 'www.tar.gz', size: r.size || 0, ok: r.ok };
    }

    const files = fs.readdirSync(destDir).filter((f) => f !== 'manifest.json');
    manifest.totalSize = files.reduce((acc, f) => {
      try { return acc + fs.statSync(path.join(destDir, f)).size; } catch { return acc; }
    }, 0);
    fs.writeFileSync(path.join(destDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    send(`\n[OK] Total: ${fmtBytes(manifest.totalSize)}\n`);
    send(`COMPLETE:${id}\n`);
  } catch (e) {
    send(`\n[ERROR] ${e.message}\n`);
    send(`COMPLETE:ERROR\n`);
  }
  res.end();
});

// Descargar un ítem individual — guarda en backup dir y devuelve { id, file }
router.get('/download-item', async (req, res) => {
  const { type, name } = req.query;
  if (!type || !name || typeof type !== 'string' || typeof name !== 'string') {
    return res.status(400).json({ error: 'type y name requeridos' });
  }

  const safeName = name.replace(/[;&|`$(){}\[\]<>\n\r]/g, '');
  const base = path.basename(safeName) || safeName;

  const P = 'export PATH=$PATH:/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin; ';
  const commands = {
    mysql:    `${P}mysqldump --single-transaction --quick "${safeName}" | gzip`,
    mongo:    `${P}D=$(mktemp -d /tmp/.mhq_XXXXXX) && mkdir -p "$D" && (mongosh --quiet "${safeName}" --eval "db.getCollectionNames().forEach(c=>print(c))" 2>/dev/null || mongo --quiet "${safeName}" --eval "db.getCollectionNames().forEach(function(c){print(c)})" 2>/dev/null) | while IFS= read -r col; do [ -n "$col" ] && mongoexport --db="${safeName}" --collection="$col" --jsonArray 2>/dev/null > "$D/$col.json"; done && tar -czf - -C "$D" . && rm -rf "$D" || (rm -rf "$D" 2>/dev/null; false)`,
    postgres: `${P}pg_dump -U postgres "${safeName}" | gzip`,
    nginx:    `${P}tar -czf - "/etc/nginx/sites-available/${base}" 2>/dev/null || true`,
    www:      `${P}tar -czf - "${safeName}" 2>/dev/null || true`,
  };
  const extensions = { mysql: '.sql.gz', mongo: '.tar.gz', postgres: '.sql.gz', nginx: '.tar.gz', www: '.tar.gz' };

  const cmd = commands[type];
  if (!cmd) return res.status(400).json({ error: 'Tipo inválido' });

  const filename = `${base}${extensions[type] || '.tar.gz'}`;

  // Guardar en backup dir para que aparezca en la lista
  const BACKUP_DIR = getBackupDir();
  const id = `${type}-${base}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
  const destDir = path.join(BACKUP_DIR, id);
  fs.mkdirSync(destDir, { recursive: true });
  const localFile = path.join(destDir, filename);

  const ssh = useSSH();
  const srv = ssh ? getServer() : null;

  try {
    let stderrMsg = '';

    if (ssh) {
      if (!srv) {
        fs.rmSync(destDir, { recursive: true, force: true });
        return res.status(503).json({ error: 'Sin servidor SSH configurado' });
      }
      const ws = fs.createWriteStream(localFile);
      await sshPipeToFile(srv, cmd, ws, (e) => { stderrMsg += e; }, 300000);
    } else {
      const { execSync } = require('child_process');
      const out = execSync(cmd, { maxBuffer: 512 * 1024 * 1024, timeout: 300000 });
      fs.writeFileSync(localFile, out);
    }

    const size = fs.existsSync(localFile) ? fs.statSync(localFile).size : 0;
    const hasError = /error|failed|denied|cannot|unable|not found|refused/i.test(stderrMsg.toLowerCase());

    if (size < 500 || (hasError && size < 5000)) {
      fs.rmSync(destDir, { recursive: true, force: true });
      const hint = stderrMsg.trim().split('\n').filter(Boolean).pop() || '';
      return res.status(502).json({
        error: hint || `El archivo está vacío (${size} bytes). Verifica que el servicio está activo y tiene permisos.`,
      });
    }

    const manifest = {
      _mhq: true,
      timestamp: new Date().toISOString(),
      source: ssh ? 'ssh' : 'local',
      host: srv?.name || os.hostname(),
      components: { [type]: { file: filename, size, ok: true } },
      totalSize: size,
    };
    fs.writeFileSync(path.join(destDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    res.json({ ok: true, id, file: filename });
  } catch (e) {
    fs.rmSync(destDir, { recursive: true, force: true });
    res.status(502).json({ error: e.message });
  }
});

// Detalles de cada componente (para modal)
router.get('/details/:type', async (req, res) => {
  const ssh = useSSH();
  const srv = ssh ? getServer() : null;

  const cmds = {
    mysql:    'mysql -N -e "SHOW DATABASES;" 2>/dev/null',
    mongo:    'mongosh --quiet --eval "db.adminCommand({listDatabases:1}).databases.forEach(d=>print(d.name+\'|\'+d.sizeOnDisk))" 2>/dev/null || mongo --quiet --eval "db.adminCommand({listDatabases:1}).databases.forEach(d=>print(d.name+\'|\'+d.sizeOnDisk))" 2>/dev/null',
    postgres: 'psql -U postgres -t -c "SELECT datname FROM pg_database WHERE datistemplate = false;" 2>/dev/null',
    nginx:    'ls /etc/nginx/sites-available/ 2>/dev/null | while read f; do echo "$f|$([ -L /etc/nginx/sites-enabled/$f ] && echo enabled || echo disabled)"; done',
    www:      'du -sh /var/www/* 2>/dev/null | sort -rh | awk \'{print $2"|"$1}\'',
  };

  const cmd = cmds[req.params.type];
  if (!cmd) return res.status(404).json({ error: 'Tipo desconocido' });

  try {
    let out = '';
    if (ssh && srv) out = await sshExec(srv, cmd, 10000);
    else out = await new Promise((resolve) => exec(cmd, { timeout: 10000 }, (_, stdout) => resolve(stdout || '')));

    const lines = out.split('\n').filter(Boolean).map((l) => {
      const [name, meta] = l.split('|');
      return { name: name?.trim(), meta: meta?.trim() };
    });
    res.json({ type: req.params.type, items: lines });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Descargar archivo del backup
router.get('/:id/download/:file', (req, res) => {
  const BACKUP_DIR = getBackupDir();
  const filePath   = path.resolve(path.join(BACKUP_DIR, req.params.id, req.params.file));
  if (!filePath.startsWith(BACKUP_DIR)) return res.status(403).json({ error: 'Acceso denegado' });
  if (!fs.existsSync(filePath))         return res.status(404).json({ error: 'Archivo no encontrado' });
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.file}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', fs.statSync(filePath).size);
  fs.createReadStream(filePath).pipe(res);
});

// Eliminar backup
router.delete('/:id', (req, res) => {
  const BACKUP_DIR = getBackupDir();
  const dir = path.resolve(path.join(BACKUP_DIR, req.params.id));
  if (!dir.startsWith(BACKUP_DIR))  return res.status(403).json({ error: 'Acceso denegado' });
  if (!fs.existsSync(dir))          return res.status(404).json({ error: 'Backup no encontrado' });
  fs.rmSync(dir, { recursive: true, force: true });
  res.json({ ok: true });
});

module.exports = router;
