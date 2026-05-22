import { createHmac, randomBytes } from 'crypto';

// HMAC-signed tokens: no shared in-memory state needed.
// Both the Next.js API route and server.ts verify the signature
// independently using the same secret from env vars.

// Leído dinámicamente para que server.ts lo lea DESPUÉS de que Next.js cargue .env.local
const getSecret = () => process.env.JWT_SECRET || 'martinhq_terminal_dev_secret';

export function issueToken(): string {
  const ts = Date.now();
  const nonce = randomBytes(8).toString('hex');
  const payload = `${ts}.${nonce}`;
  const sig = createHmac('sha256', getSecret()).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

export function consumeToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const lastDot = decoded.lastIndexOf('.');
    const payload = decoded.slice(0, lastDot);
    const sig = decoded.slice(lastDot + 1);

    const expected = createHmac('sha256', getSecret()).update(payload).digest('hex');
    if (sig !== expected) return false;

    const ts = parseInt(payload.split('.')[0], 10);
    return Date.now() - ts < 30_000; // válido por 30s
  } catch {
    return false;
  }
}
