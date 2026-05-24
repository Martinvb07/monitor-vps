import { config as loadEnv } from 'dotenv';
loadEnv({ path: '../.env' }); // Un solo .env para todo

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import { Client } from 'ssh2';
import { consumeToken } from './lib/terminal-tokens';

const dev = process.env.NODE_ENV !== 'production';
const port   = parseInt(process.env.FRONTEND_PORT   || '3001', 10); // Next.js
const wsPort = parseInt(process.env.TERMINAL_WS_PORT || '3002', 10); // Terminal SSH WS
const app = next({ dev, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Servidor principal Next.js — sin tocar los upgrades (HMR funciona limpio)
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url!, true));
  });

  // Servidor WebSocket separado en puerto 3002 — evita conflicto con Next.js HMR
  const wsHttpServer = createServer();
  const wss = new WebSocketServer({ server: wsHttpServer });

  // Carga configs de servidores desde el .env (mismo formato que services/servers.js)
  function loadServerConfig(id?: string | null): Parameters<Client['connect']>[0] {
    // Si piden un servidor remoto configurado (SERVER_1_*, SERVER_2_*, ...)
    if (id && /^\d+$/.test(id)) {
      const host     = process.env[`SERVER_${id}_HOST`];
      const user     = process.env[`SERVER_${id}_USER`]     || 'root';
      const password = process.env[`SERVER_${id}_PASSWORD`] || undefined;
      const keyPath  = process.env[`SERVER_${id}_KEY_PATH`] || undefined;
      const port     = parseInt(process.env[`SERVER_${id}_PORT`] || '22', 10);
      if (host) {
        return {
          host, port, username: user, readyTimeout: 10000,
          ...(keyPath
            ? { privateKey: require('fs').readFileSync(keyPath) }
            : { password: password || '' }),
        };
      }
    }
    // Servidor principal (SSH_HOST del .env)
    return {
      host:     process.env.SSH_HOST || '127.0.0.1',
      port:     parseInt(process.env.SSH_PORT || '22', 10),
      username: process.env.SSH_USER || 'root',
      readyTimeout: 10000,
      ...(process.env.SSH_PRIVATE_KEY
        ? { privateKey: process.env.SSH_PRIVATE_KEY.replace(/\\n/g, '\n') }
        : { password: process.env.SSH_PASSWORD || '' }),
    };
  }

  wss.on('connection', (ws, req) => {
    const { query } = parse(req.url!, true);
    const token    = Array.isArray(query.token)  ? query.token[0]  : query.token;
    const serverId = Array.isArray(query.server) ? query.server[0] : query.server;

    if (!token || !consumeToken(token)) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    handleTerminal(ws, serverId);
  });

  wsHttpServer.listen(wsPort, () => {
    console.log(`> WebSocket terminal en ws://localhost:${wsPort}`);
  });

  function handleTerminal(ws: WebSocket, serverId?: string | null) {
    const ssh = new Client();
    const sshConfig = loadServerConfig(serverId);

    const send = (type: string, data?: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, data }));
      }
    };

    ssh.on('ready', () => {
      ssh.shell({ term: 'xterm-256color', rows: 24, cols: 80 }, (err, stream) => {
        if (err) {
          send('output', `\r\n\x1b[31m✗ Error al abrir shell: ${err.message}\x1b[0m\r\n`);
          ws.close();
          return;
        }

        send('ready');

        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw.toString());
            if (msg.type === 'input') stream.write(msg.data);
            if (msg.type === 'resize') stream.setWindow(msg.rows, msg.cols, 0, 0);
          } catch { /* ignore malformed frames */ }
        });

        stream.on('data', (chunk: Buffer) => send('output', chunk.toString()));

        stream.on('close', () => {
          send('output', '\r\n\x1b[33m[Sesión terminada]\x1b[0m\r\n');
          ws.close();
          ssh.end();
        });

        ws.on('close', () => ssh.end());
      });
    });

    ssh.on('error', (err) => {
      send('output', `\r\n\x1b[31m✗ SSH Error: ${err.message}\x1b[0m\r\n`);
      ws.close();
    });

    send('output', `\r\n\x1b[90mConectando a ${sshConfig.host}...\x1b[0m\r\n`);
    ssh.connect(sshConfig);
  }

  server.listen(port, () => {
    console.log(`> MARTIN.HQ listo en http://localhost:${port}`);
  });
});
