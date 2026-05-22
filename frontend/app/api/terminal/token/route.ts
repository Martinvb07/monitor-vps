import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { issueToken } from '@/lib/terminal-tokens';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const secret = process.env.JWT_SECRET;

  // En desarrollo sin JWT_SECRET configurado: saltamos la verificación
  if (secret) {
    try {
      jwt.verify(auth.slice(7), secret);
    } catch {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'JWT_SECRET no configurado' }, { status: 500 });
  }

  const wsToken = issueToken();
  return NextResponse.json({ token: wsToken });
}
