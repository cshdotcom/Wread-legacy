/**
 * WRead Storage Stats API Route
 * GET /api/storage/stats - Get storage usage statistics
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateUserAndToken } from '@/utils/wread-auth';
import { getStorageStats, findUserById } from '@/utils/wread-db';

export async function GET(req: NextRequest) {
  const { user } = await validateUserAndToken(req.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const userId = (user as Record<string, unknown>).id as string;
  const stats = getStorageStats(userId);
  const dbUser = findUserById(userId);

  const quotaBytes = parseInt(process.env['STORAGE_FIXED_QUOTA'] || '10737418240');
  const usageBytes = dbUser?.storage_usage_bytes || stats.totalSize;

  return NextResponse.json({
    total_files: stats.totalFiles,
    total_size: stats.totalSize,
    usage_bytes: usageBytes,
    quota_bytes: quotaBytes,
    usage_percentage: quotaBytes > 0 ? (usageBytes / quotaBytes) * 100 : 0,
  });
}
