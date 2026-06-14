/**
 * WRead Share Download Confirm Route
 * POST /api/share/[token]/download/confirm
 * Best-effort analytics ping — increments download count for the share.
 * In WRead self-hosted, uses local SQLite instead of Supabase RPC.
 */
import { NextResponse } from 'next/server';
import { hashShareToken, isValidShareToken } from '@/libs/shareServer';
import { getDb } from '@/utils/wread-db';

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { token } = await params;

  if (!isValidShareToken(token)) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const tokenHash = await hashShareToken(token);
    const nowIso = new Date().toISOString();

    // Atomic conditional update — only increment if share is still active
    const db = getDb();
    db.prepare(`
      UPDATE book_shares
      SET download_count = download_count + 1
      WHERE token_hash = ?
        AND (expires_at IS NULL OR expires_at > ?)
    `).run(tokenHash, nowIso);
  } catch (error) {
    // Best-effort beacon — log but never surface to the caller.
    console.error('download confirm failed:', error);
  }

  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
