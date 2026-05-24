'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getToken } from '@/lib/auth';
import { api, type RemoteServer } from '@/lib/api';
import '@xterm/xterm/css/xterm.css';

type ConnStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export default function TerminalPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import('@xterm/xterm').Terminal | null>(null);
  const fitRef = useRef<import('@xterm/addon-fit').FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [servers, setServers] = useState<RemoteServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('main'); // 'main' = servidor principal

  useEffect(() => {
    api.servers().then(setServers).catch(() => {});
  }, []);

  // Initialize xterm on mount
  useEffect(() => {
    let term: import('@xterm/xterm').Terminal;
    let fitAddon: import('@xterm/addon-fit').FitAddon;

    Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
    ]).then(([{ Terminal }, { FitAddon }]) => {
      if (!containerRef.current || termRef.current) return;

      term = new Terminal({
        fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
        fontSize: 13,
        lineHeight: 1.4,
        cursorBlink: true,
        cursorStyle: 'block',
        theme: {
          background: '#111110',
          foreground: '#f0ece2',
          cursor: '#e63319',
          cursorAccent: '#111110',
          selectionBackground: '#3a3733',
          black: '#111110',
          red: '#e63319',
          green: '#1a8a4a',
          yellow: '#d97706',
          blue: '#4a9eff',
          magenta: '#b06be0',
          cyan: '#0ea5e9',
          white: '#f0ece2',
          brightBlack: '#7a756a',
          brightRed: '#ff5a3d',
          brightGreen: '#34d36a',
          brightYellow: '#fbbf24',
          brightBlue: '#60afff',
          brightMagenta: '#c084fc',
          brightCyan: '#38bdf8',
          brightWhite: '#ffffff',
        },
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);
      fitAddon.fit();

      termRef.current = term;
      fitRef.current = fitAddon;

      // Clic derecho = pegar desde clipboard
      containerRef.current.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        navigator.clipboard.readText().then((text) => {
          if (text && termRef.current) termRef.current.paste(text);
        }).catch(() => {});
      });

      // Ctrl+Alt+C = copiar / Ctrl+Alt+V = pegar
      term.attachCustomKeyEventHandler((e) => {
        if (e.ctrlKey && e.altKey && e.key === 'c') {
          const sel = term.getSelection();
          if (sel) navigator.clipboard.writeText(sel).catch(() => {});
          return false;
        }
        if (e.ctrlKey && e.altKey && e.key === 'v') {
          navigator.clipboard.readText().then((text) => {
            if (text) term.paste(text);
          }).catch(() => {});
          return false;
        }
        return true;
      });

      term.writeln('\x1b[90m╔══════════════════════════════════════╗\x1b[0m');
      term.writeln('\x1b[90m║\x1b[0m  MARTIN\x1b[31m.\x1b[0mHQ  —  Terminal SSH         \x1b[90m║\x1b[0m');
      term.writeln('\x1b[90m╚══════════════════════════════════════╝\x1b[0m');
      term.writeln('');
      term.writeln('\x1b[90mPresiona [Conectar] para iniciar sesión SSH.\x1b[0m');
      term.writeln('');
    });

    const ro = new ResizeObserver(() => fitRef.current?.fit());
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      termRef.current?.dispose();
      termRef.current = null;
      wsRef.current?.close();
    };
  }, []);

  const connect = useCallback(async () => {
    setStatus('connecting');
    setErrorMsg('');

    const authToken = getToken();
    if (!authToken) {
      setStatus('error');
      setErrorMsg('No autenticado');
      return;
    }

    // Get a short-lived WebSocket token
    let wsToken: string;
    try {
      const res = await fetch('/api/terminal/token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      wsToken = data.token;
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Error al autenticar');
      termRef.current?.writeln(`\r\n\x1b[31m✗ ${err instanceof Error ? err.message : 'Error'}\x1b[0m`);
      return;
    }

    // Connect WebSocket con server selector
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsPort = process.env.NEXT_PUBLIC_WS_PORT || '3002';
    const serverParam = selectedServer !== 'main' ? `&server=${selectedServer}` : '';
    const ws = new WebSocket(`${proto}//${window.location.hostname}:${wsPort}?token=${wsToken}${serverParam}`);
    wsRef.current = ws;

    ws.onopen = () => {
      termRef.current?.clear();
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'ready') {
          setStatus('connected');
          // Send input from xterm to WebSocket
          termRef.current?.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'input', data }));
            }
          });
          // Send resize events
          termRef.current?.onResize(({ rows, cols }) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'resize', rows, cols }));
            }
          });
          fitRef.current?.fit();
        }
        if (msg.type === 'output' && msg.data) {
          termRef.current?.write(msg.data);
        }
      } catch { /* ignore */ }
    };

    ws.onerror = () => {
      setStatus('error');
      setErrorMsg('Error de conexión WebSocket');
    };

    ws.onclose = () => {
      setStatus((prev) => prev === 'error' ? 'error' : 'disconnected');
      wsRef.current = null;
    };
  }, [status]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('disconnected');
    termRef.current?.writeln('\r\n\x1b[90m[Desconectado]\x1b[0m');
  }, []);

  const sshHost = selectedServer === 'main'
    ? (process.env.NEXT_PUBLIC_SSH_HOST || '—')
    : (servers.find((s) => s.id === selectedServer)?.host || '—');
  const sshUser = selectedServer === 'main'
    ? (process.env.NEXT_PUBLIC_SSH_USER || 'root')
    : (servers.find((s) => s.id === selectedServer)?.user || 'root');

  const statusLabel: Record<ConnStatus, string> = {
    idle: 'Desconectado',
    connecting: 'Conectando...',
    connected: 'Conectado',
    disconnected: 'Desconectado',
    error: 'Error',
  };

  const statusColor: Record<ConnStatus, string> = {
    idle: 'var(--muted)',
    connecting: 'var(--warn)',
    connected: 'var(--up)',
    disconnected: 'var(--muted)',
    error: 'var(--down)',
  };

  return (
    <>
      <div className="sec-marker reveal in">
        <span className="num">// 007</span>
        <span className="ttl">TERMINAL_SSH</span>
        <span className="meta" style={{ color: statusColor[status] }}>
          ● {statusLabel[status]}
        </span>
      </div>

      <div className="term-toolbar reveal in">
        <div className="term-info">
          {/* Selector de servidor — siempre visible si hay remotes o no está conectado */}
          {status !== 'connected' && (
            <>
              <span className="term-info-label">Servidor</span>
              <select
                value={selectedServer}
                onChange={(e) => setSelectedServer(e.target.value)}
                style={{
                  background: 'var(--paper-2)', border: '1px solid var(--rule)',
                  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink)',
                  padding: '3px 8px', cursor: 'pointer', outline: 'none',
                }}
              >
                <option value="main">{process.env.NEXT_PUBLIC_SSH_HOST || 'VPS Principal'}</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.host})</option>
                ))}
              </select>
            </>
          )}
          <span className="term-info-label">Host</span>
          <span className="term-info-value">{sshHost}</span>
          <span className="term-info-label">Usuario</span>
          <span className="term-info-value">{sshUser}</span>
        </div>
        <div className="term-actions">
          {errorMsg && (
            <span className="term-error">{errorMsg}</span>
          )}
          {status === 'connected' ? (
            <button className="btn-term-action disconnect" onClick={disconnect}>
              ✕ Desconectar
            </button>
          ) : (
            <button
              className="btn-term-action connect"
              onClick={connect}
              disabled={status === 'connecting'}
            >
              {status === 'connecting' ? '...' : '→ Conectar'}
            </button>
          )}
        </div>
      </div>

      <div className="term-shell" ref={containerRef} />
    </>
  );
}
