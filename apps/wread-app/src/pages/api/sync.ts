// @ts-nocheck
/**
 * WRead Sync API Route
 * Rewritten to use local SQLite instead of Supabase.
 * Preserves the same API interface for the frontend.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { NextRequest, NextResponse } from 'next/server';
import { validateUserAndToken } from '@/utils/wread-auth';
import {
  getBooks,
  getBookConfigs,
  getBookNotes,
  upsertBook,
  upsertBookConfig,
  upsertBookNote,
  updateUser,
  findUserById,
} from '@/utils/wread-db';
import { runMiddleware, corsAllMethods } from '@/utils/cors';
import { SyncData, SyncResult } from '@/libs/sync';

export async function GET(req: NextRequest) {
  const { user, token } = await validateUserAndToken(req.headers.get('authorization'));
  if (!user || !token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 403 });
  }

  const userId = (user as Record<string, unknown>).id as string;
  const { searchParams } = new URL(req.url);
  const sinceParam = searchParams.get('since');
  const typeParam = searchParams.get('type');
  const bookParam = searchParams.get('book');
  const metaHashParam = searchParams.get('meta_hash');

  const since = sinceParam ? new Date(Number(sinceParam)).toISOString() : undefined;

  try {
    const results: SyncResult = { books: [], configs: [], notes: [] };

    if (!typeParam || typeParam === 'books') {
      results.books = getBooks(userId, since, bookParam || undefined, metaHashParam || undefined);
    }
    if (!typeParam || typeParam === 'configs') {
      results.configs = getBookConfigs(userId, since, bookParam || undefined);
    }
    if (!typeParam || typeParam === 'notes') {
      results.notes = getBookNotes(userId, since, bookParam || undefined);
    }

    const response = NextResponse.json(results, { status: 200 });
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Pragma', 'no-cache');
    response.headers.delete('ETag');
    return response;
  } catch (error: unknown) {
    console.error(error);
    const errorMessage = (error as Error).message || 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, token } = await validateUserAndToken(req.headers.get('authorization'));
  if (!user || !token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 403 });
  }

  const userId = (user as Record<string, unknown>).id as string;

  try {
    const body = await req.json();
    const { books = [], configs = [], notes = [] } = body as SyncData;

    // Process books
    const booksResult: Record<string, unknown>[] = [];
    for (const book of books) {
      upsertBook(userId, book);
      booksResult.push(book);
    }

    // Process configs
    const configsResult: Record<string, unknown>[] = [];
    for (const config of configs) {
      upsertBookConfig(userId, config);
      configsResult.push(config);

      // Piggyback progress update to books table
      if (config.book_hash && config.progress) {
        const dbUser = findUserById(userId);
        if (dbUser) {
          // Progress is already handled in upsertBook
        }
      }
    }

    // Process notes
    const notesResult: Record<string, unknown>[] = [];
    for (const note of notes) {
      upsertBookNote(userId, note);
      notesResult.push(note);
    }

    return NextResponse.json(
      {
        books: booksResult,
        configs: configsResult,
        notes: notesResult,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error(error);
    const errorMessage = (error as Error).message || 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
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

    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export default handler;
