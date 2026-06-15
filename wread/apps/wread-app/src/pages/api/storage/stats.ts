/**
 * WRead Storage Stats API Route
 * GET /api/storage/stats - Get storage usage statistics
 * Rewritten to use local SQLite instead of Supabase.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { NextRequest, NextResponse } from 'next/server';
import { validateUserAndToken } from '@/utils/wread-auth';
import { getStorageStats, findUserById } from '@/utils/wread-db';
import { getStoragePlanData } from '@/utils/access';
import { runMiddleware, corsAllMethods } from '@/utils/cors';

export async function GET(req: NextRequest) {
  const { user, token } = await validateUserAndToken(req.headers.get('authorization'));
  if (!user || !token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const userId = (user as Record<string, unknown>).id as string;
  const stats = getStorageStats(userId);
  const dbUser = findUserById(userId);

  // Use quota from JWT/env, not hardcoded
  const planData = getStoragePlanData(token);

  return NextResponse.json({
    totalFiles: stats.totalFiles,
    totalSize: stats.totalSize,
    usage: dbUser?.storage_usage_bytes || stats.totalSize,
    quota: planData.quota,
    usagePercentage: planData.quota > 0 ? Math.round((planData.usage / planData.quota) * 100) : 0,
    byBookHash: [], // Could be implemented later if needed
  });
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  await runMiddleware(req, res, corsAllMethods);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const protocol = process.env['PROTOCOL'] || 'http';
    const host = process.env['HOST'] || 'localhost:3000';
    const url = new URL(req.url || '/', `${protocol}://${host}`);
    const nextReq = new NextRequest(url.toString(), {
      headers: new Headers(req.headers as Record<string, string>),
      method: 'GET',
    });
    const response = await GET(nextReq);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export default handler;
