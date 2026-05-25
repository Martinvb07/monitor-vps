const { Client } = require('ssh2');

// Lee configs de servidores desde el .env
// SERVER_1_NAME, SERVER_1_HOST, SERVER_1_USER, SERVER_1_PASSWORD / SERVER_1_KEY
// SERVER_2_NAME, SERVER_2_HOST, etc.
function loadServers() {
  const servers = [];
  for (let i = 1; i <= 10; i++) {
    const host = process.env[`SERVER_${i}_HOST`];
    if (!host) continue; // salta huecos, no rompe
    servers.push({
      id:       i.toString(),
      name:     process.env[`SERVER_${i}_NAME`] || `Servidor ${i}`,
      host,
      user:     process.env[`SERVER_${i}_USER`]     || 'root',
      password: process.env[`SERVER_${i}_PASSWORD`] || null,
      keyPath:  process.env[`SERVER_${i}_KEY_PATH`] || null,
      port:     parseInt(process.env[`SERVER_${i}_PORT`] || '22'),
    });
  }
  return servers;
}

function sshExec(serverCfg, command, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = '';

    const timer = setTimeout(() => {
      conn.end();
      reject(new Error('SSH timeout'));
    }, timeout);

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) { clearTimeout(timer); conn.end(); return reject(err); }
        stream.on('data', (d) => { output += d.toString(); });
        stream.stderr.on('data', (d) => { output += d.toString(); });
        stream.on('close', () => {
          clearTimeout(timer);
          conn.end();
          resolve(output.trim());
        });
      });
    });

    conn.on('error', (err) => { clearTimeout(timer); reject(err); });

    const auth = { host: serverCfg.host, port: serverCfg.port, username: serverCfg.user };
    if (serverCfg.password) {
      auth.password = serverCfg.password;
    } else if (serverCfg.keyPath) {
      const fs = require('fs');
      auth.privateKey = fs.readFileSync(serverCfg.keyPath);
    } else {
      return reject(new Error(`Servidor ${serverCfg.name}: sin credenciales configuradas`));
    }

    conn.connect(auth);
  });
}

async function getMetrics(serverCfg) {
  // Lee CPU con delta de /proc/stat para % real, más los 3 load avgs
  const cmd = [
    'echo "CPU1:$(cat /proc/stat | head -1)"',
    'sleep 0.3',
    'echo "CPU2:$(cat /proc/stat | head -1)"',
    'echo "LOAD:$(cat /proc/loadavg)"',
    'echo "CORES:$(nproc)"',
    'echo "MEM:$(free -m | awk \'NR==2{print $2\\":\\"$3\\":\\"$4}\')"',
    'echo "DISK:$(df -BM / | awk \'NR==2{gsub("M","",$2);gsub("M","",$3);gsub("M","",$4);print $2\\":\\"$3\\":\\"$4}\')"',
    'echo "UPTIME:$(cat /proc/uptime | awk \'{print $1}\')"',
    'echo "HOST:$(hostname)"',
  ].join(' && ');

  const out = await sshExec(serverCfg, cmd);
  const lines = {};
  out.split('\n').forEach((l) => {
    const idx = l.indexOf(':');
    if (idx !== -1) lines[l.slice(0, idx)] = l.slice(idx + 1);
  });

  // CPU % via /proc/stat delta
  let cpuPct = 0;
  try {
    const v1 = (lines.CPU1 || '').trim().split(/\s+/).slice(1).map(Number);
    const v2 = (lines.CPU2 || '').trim().split(/\s+/).slice(1).map(Number);
    const total = v2.reduce((a, b) => a + b, 0) - v1.reduce((a, b) => a + b, 0);
    const idle  = (v2[3] + (v2[4] || 0)) - (v1[3] + (v1[4] || 0));
    cpuPct = total === 0 ? 0 : Math.min(100, Math.round(((total - idle) / total) * 100));
  } catch { /* fallback a 0 */ }

  const loadParts = (lines.LOAD || '0 0 0').split(' ');
  const loadAvg   = [parseFloat(loadParts[0]) || 0, parseFloat(loadParts[1]) || 0, parseFloat(loadParts[2]) || 0];
  const cores     = parseInt(lines.CORES || '1');

  const [memT, memU, memF] = (lines.MEM  || '0:0:0').split(':').map(Number);
  const [dskT, dskU, dskF] = (lines.DISK || '0:0:0').split(':').map(Number);
  const uptime = parseFloat(lines.UPTIME || '0');

  return {
    cpu:  { pct: cpuPct, load: loadAvg, cores },
    ram:  { total: memT, used: memU, free: memF, pct: memT ? Math.round((memU / memT) * 100) : 0 },
    disk: dskT ? { total: dskT, used: dskU, free: dskF, pct: Math.round((dskU / dskT) * 100) } : null,
    uptime,
    hostname: lines.HOST || serverCfg.name,
    platform: 'linux',
  };
}

async function getPm2(serverCfg) {
  const out = await sshExec(serverCfg, 'pm2 jlist 2>/dev/null || echo "[]"');
  try {
    const list = JSON.parse(out);
    return list.map((p) => ({
      id:       p.pm_id,
      name:     p.name,
      status:   p.pm2_env?.status || 'unknown',
      uptime:   p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : 0,
      cpu:      p.monit?.cpu    ?? 0,
      memory:   p.monit?.memory ?? 0,
      restarts: p.pm2_env?.restart_time ?? 0,
      pid:      p.pid ?? 0,
    }));
  } catch { return []; }
}

async function restartPm2(serverCfg, name) {
  return sshExec(serverCfg, `pm2 restart ${name} 2>&1`);
}

async function readFile(serverCfg, filePath) {
  return sshExec(serverCfg, `cat "${filePath}" 2>/dev/null || echo "__NOT_FOUND__"`);
}

async function writeFile(serverCfg, filePath, content) {
  const escaped = content.replace(/\\/g, '\\\\').replace(/'/g, `'\\''`);
  const backup  = filePath + '.bak';
  const cmd = `cp "${filePath}" "${backup}" 2>/dev/null; printf '%s' '${escaped}' > "${filePath}"`;
  await sshExec(serverCfg, cmd);
  return { ok: true, backup };
}

async function listEnvFiles(serverCfg, searchDirs = ['/var/www']) {
  const dirs = searchDirs.join(' ');
  const cmd  = `find -L ${dirs} -maxdepth 5 \\( -name ".env" -o -name ".env.local" -o -name ".env.production" -o -name ".env.development" \\) 2>/dev/null | sort -u`;
  const out  = await sshExec(serverCfg, cmd);
  return out.split('\n').filter(Boolean).map(p => {
    const parts  = p.split('/').filter(Boolean);
    const file   = parts.pop();
    // Toma los últimos 2 segmentos del path como nombre del proyecto
    // ej: /var/www/reservatucancha/Backend → "reservatucancha / Backend"
    // ej: /var/www/geoworldmc-bot → "geoworldmc-bot"
    const genericNames = ['backend', 'frontend', 'src', 'app', 'server', 'api'];
    const last = parts[parts.length - 1] || '';
    const prev = parts[parts.length - 2] || '';
    const project = genericNames.includes(last.toLowerCase()) && prev
      ? `${prev} / ${last}`
      : last;
    return { id: Buffer.from(p).toString('base64'), project, file, path: p };
  });
}

async function listNginxConfigs(serverCfg) {
  const cmd = `ls /etc/nginx/sites-available/ 2>/dev/null && echo "---ENABLED---" && ls /etc/nginx/sites-enabled/ 2>/dev/null`;
  const out  = await sshExec(serverCfg, cmd);
  const [availSection, enabledSection] = out.split('---ENABLED---');
  const available = (availSection || '').trim().split('\n').filter(Boolean);
  const enabled   = new Set((enabledSection || '').trim().split('\n').filter(Boolean));
  return available.map(name => ({
    name,
    path:    `/etc/nginx/sites-available/${name}`,
    enabled: enabled.has(name),
  }));
}

async function writeScript(serverCfg, sitioId, content) {
  const path = `/root/deploy_${sitioId}.sh`;
  const escaped = content.replace(/'/g, `'\\''`);
  await sshExec(serverCfg, `printf '%s' '${escaped}' > ${path} && chmod +x ${path}`);
  return path;
}

async function readScript(serverCfg, sitioId) {
  try {
    return await sshExec(serverCfg, `cat /root/deploy_${sitioId}.sh 2>/dev/null || echo ""`);
  } catch { return ''; }
}

async function runScript(serverCfg, sitioId) {
  return sshExec(serverCfg, `/root/deploy_${sitioId}.sh 2>&1`, 300000);
}

// Pipe SSH stdout directamente a un WriteStream local (para backups)
function sshPipeToFile(serverCfg, command, writeStream, onProgress, timeout = 600000) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const timer = setTimeout(() => { conn.end(); reject(new Error('SSH timeout')); }, timeout);

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) { clearTimeout(timer); conn.end(); return reject(err); }

        stream.pipe(writeStream, { end: false });
        stream.stderr.on('data', (d) => onProgress && onProgress(d.toString()));

        stream.on('close', () => {
          clearTimeout(timer);
          conn.end();
          // end() is async — wait for 'finish' before resolving so callers can stat the file
          writeStream.end();
          writeStream.once('finish', resolve);
          writeStream.once('error', resolve);
        });

        stream.on('error', (e) => { clearTimeout(timer); conn.end(); reject(e); });
        writeStream.on('error', (e) => { clearTimeout(timer); conn.end(); reject(e); });
      });
    });

    conn.on('error', (err) => { clearTimeout(timer); reject(err); });

    const auth = { host: serverCfg.host, port: serverCfg.port, username: serverCfg.user, readyTimeout: 15000 };
    if (serverCfg.password)      auth.password   = serverCfg.password;
    else if (serverCfg.keyPath)  auth.privateKey = require('fs').readFileSync(serverCfg.keyPath);
    else return reject(new Error(`Servidor ${serverCfg.name}: sin credenciales`));

    conn.connect(auth);
  });
}

module.exports = { loadServers, sshExec, sshPipeToFile, getMetrics, getPm2, restartPm2, writeScript, readScript, runScript, readFile, writeFile, listEnvFiles, listNginxConfigs };
