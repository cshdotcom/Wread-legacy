/**
 * WRead Sync Replica Keys API Route
 * Rewritten to use local SQLite instead of Supabase.
 * Simplified replica key management for self-hosted deployment.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { NextRequest, NextResponse } from 'next/server';
import { validateUserAndToken } from '@/utils/wread-auth';
import { getDb } from '@/utils/wread-db';
import { runMiddleware, corsAllMethods } from '@/utils/cors';
import { v4 as uuidv4 } from 'uuid';

const SUPPORTED_ALGS = new Set<string>(['pbkdf2-600k-sha256']);

const errorResponse = (status: number, code: string, message: string) =>
  NextResponse.json({ error: message, code }, { status });

export async function GET(req: NextRequest) {
  const { user, token } = await validateUserAndToken(req.headers.get('authorization'));
  if (!user || !token) {
    return errorResponse(401, 'AUTH', 'Not authenticated');
  }
  const userId = (user as Record<string, unknown>).id as string;

  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM replica_keys WHERE user_id = ?').all(userId);
    const mapped = rows.map((row: Record<string, unknown>) => ({
      saltId: row.id,
      alg: 'pbkdf2-600k-sha256',
      salt: row.key_data,
      createdAt: row.created_at,
    }));
    return NextResponse.json({ rows: mapped }, { status: 200 });
  } catch (error) {
    console.error('Replica keys list error:', error);
    return errorResponse(500, 'SERVER', error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function POST(req: NextRequest) {
  const { user, token } = await validateUserAndToken(req.headers.get('authorization'));
  if (!user || !token) {
    return errorResponse(401, 'AUTH', 'Not authenticated');
  }
  const userId = (user as Record<string, unknown>).id as string;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'VALIDATION', 'Invalid JSON body');
  }

  const alg =
    typeof body === 'object' && body !== null && 'alg' in body
      ? (body as { alg: unknown }).alg
      : undefined;
  if (typeof alg !== 'string' || !SUPPORTED_ALGS.has(alg)) {
    return errorResponse(422, 'UNSUPPORTED_ALG', `Unsupported alg: ${String(alg)}`);
  }

  try {
    const db = getDb();
    const id = uuidv4();
    // Generate a random salt
    const crypto = await import('crypto');
    const salt = crypto.randomBytes(32).toString('base64');

    // For simplicity, key_data stores the salt; replica_id links to the user's first replica
    const replicaId = uuidv4();
    db.prepare(`
      INSERT INTO replica_keys (id, user_id, replica_id, key_data, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(id, userId, replicaId, salt);

    return NextResponse.json({
      row: {
        saltId: id,
        alg,
        salt,
        createdAt: new Date().toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Replica key create error:', error);
    return errorResponse(500, 'SERVER', error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function DELETE(req: NextRequest) {
  const { user, token } = await validateUserAndToken(req.headers.get('authorization'));
  if (!user || !token) {
    return errorResponse(401, 'AUTH', 'Not authenticated');
  }
  const userId = (user as Record<string, unknown>).id as string;

  try {
    const db = getDb();
    db.prepare('DELETE FROM replica_keys WHERE user_id = ?').run(userId);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('Replica keys forget error:', error);
    return errorResponse(500, 'SERVER', error instanceof Error ? error.message : 'Unknown error');
  }
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!req.url) {
    return res.status(400).json({ error: 'Invalid request URL' });
  }
  const protocol = process.env['PROTOCOL'] || 'http';
  const host = process.env['HOST'] || 'localhost:3000';
  const url = new URL(req.url, `${protocol}://${host}`);

  await runMiddleware(req, res, corsAllMethods);

  try {
    let response: Response;
    if (req.method === 'GET') {
      const nextReq = new NextRequest(url.toString(), {
        headers: new Headers(req.headers as Record<string, string>),
        method: 'GET',
      });
      response = await GET(nextReq);
    } else if (req.method === 'POST') {
      const nextReq = new NextRequest(url.toString(), {
        headers: new Headers(req.headers as Record<string, string>),
        method: 'POST',
        body: JSON.stringify(req.body),
      });
      response = await POST(nextReq);
    } else if (req.method === 'DELETE') {
      const nextReq = new NextRequest(url.toString(), {
        headers: new Headers(req.headers as Record<string, string>),
        method: 'DELETE',
      });
      response = await DELETE(nextReq);
    } else {
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    console.error('Error processing /api/sync/replica-keys request:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export default handler;
