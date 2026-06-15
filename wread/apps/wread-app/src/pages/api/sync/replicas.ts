/**
 * WRead Sync Replicas API Route
 * Rewritten to use local SQLite instead of Supabase.
 * Simplified replica sync for self-hosted deployment.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { NextRequest, NextResponse } from 'next/server';
import { validateUserAndToken } from '@/utils/wread-auth';
import { getDb } from '@/utils/wread-db';
import { runMiddleware, corsAllMethods } from '@/utils/cors';
import { v4 as uuidv4 } from 'uuid';

const errorResponse = (status: number, code: string, message: string) =>
  NextResponse.json({ error: message, code }, { status });

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

  try {
    const db = getDb();

    // Batch pull: { cursors: [...] }
    if (typeof body === 'object' && body !== null && 'cursors' in body) {
      const cursors = (body as { cursors: Array<{ kind: string; since?: string }> }).cursors;
      const results = cursors.map(({ kind, since }) => {
        let sql = 'SELECT * FROM replicas WHERE user_id = ? AND book_hash = ?';
        const params: unknown[] = [userId, kind];
        if (since) {
          sql += ' AND updated_at > ?';
          params.push(since);
        }
        sql += ' ORDER BY updated_at ASC LIMIT 1000';
        return { kind, rows: db.prepare(sql).all(...params) };
      });
      return NextResponse.json({ results }, { status: 200 });
    }

    // Push: { rows: [...] }
    if (typeof body === 'object' && body !== null && 'rows' in body) {
      const rows = (body as { rows: Array<Record<string, unknown>> }).rows;
      const merged: Record<string, unknown>[] = [];

      for (const row of rows) {
        const replicaId = row.replica_id as string;
        const bookHash = row.book_hash as string || '';
        const data = row.data ? JSON.stringify(row.data) : null;

        // Upsert replica
        const existing = db.prepare(
          'SELECT * FROM replicas WHERE user_id = ? AND replica_id = ?'
        ).get(userId, replicaId) as Record<string, unknown> | undefined;

        if (!existing) {
          const id = uuidv4();
          db.prepare(`
            INSERT INTO replicas (id, user_id, book_hash, replica_id, data, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          `).run(id, userId, bookHash, replicaId, data);
          merged.push({ ...row, id });
        } else {
          db.prepare(`
            UPDATE replicas SET data = ?, updated_at = datetime('now')
            WHERE user_id = ? AND replica_id = ?
          `).run(data, userId, replicaId);
          merged.push({ ...row, id: existing.id });
        }
      }

      return NextResponse.json({ rows: merged }, { status: 200 });
    }

    return errorResponse(400, 'VALIDATION', 'Invalid request body');
  } catch (error) {
    console.error('Replicas sync error:', error);
    return errorResponse(500, 'SERVER', error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function GET(req: NextRequest) {
  const { user, token } = await validateUserAndToken(req.headers.get('authorization'));
  if (!user || !token) {
    return errorResponse(401, 'AUTH', 'Not authenticated');
  }
  const userId = (user as Record<string, unknown>).id as string;

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get('kind');
  const since = searchParams.get('since');

  try {
    const db = getDb();
    let sql = 'SELECT * FROM replicas WHERE user_id = ?';
    const params: unknown[] = [userId];

    if (kind) {
      sql += ' AND book_hash = ?';
      params.push(kind);
    }
    if (since) {
      sql += ' AND updated_at > ?';
      params.push(since);
    }
    sql += ' ORDER BY updated_at ASC LIMIT 1000';

    const rows = db.prepare(sql).all(...params);
    return NextResponse.json({ rows }, { status: 200 });
  } catch (error) {
    console.error('Replicas pull error:', error);
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
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    console.error('Error processing /api/sync/replicas request:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export default handler;
