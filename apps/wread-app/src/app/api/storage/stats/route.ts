/**
 * WRead Storage Stats API Route
 * GET /api/storage/stats - Get storage usage statistics
 *
 * WRead modification: storage_purchased_bytes = 0 in the DB means UNLIMITED
 * (used for admin accounts). The UI shows "无限" (unlimited) for such users.
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateUserAndToken } from '@/utils/wread-auth';
import { getStorageStats, findUserById } from '@/utils/wread-db';

export async function GET(req: NextRequest) {
  const { user } = await validateUserAndToken(req.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const userId = (user as Record<string, unknown>)['id'] as string;
  const stats = getStorageStats(userId);
  const dbUser = findUserById(userId);

  const usageBytes = dbUser?.storage_usage_bytes || stats.totalSize;

  // WRead: Check if user has unlimited storage (storage_purchased_bytes = 0 AND plan = pro means admin unlimited)
  // In WRead's self-hosted model:
  // - Admin users (plan='pro') with storage_purchased_bytes=0 have UNLIMITED storage
  // - Regular users have their quota from STORAGE_FIXED_QUOTA env var
  // - storage_purchased_bytes > 0 means additional purchased quota
  const isAdmin = dbUser?.plan === 'pro' && (dbUser?.storage_purchased_bytes === 0);
  const fixedQuotaBytes = parseInt(process.env['STORAGE_FIXED_QUOTA'] || '10737418240');

  let quotaBytes: number;
  let isUnlimited: boolean;

  if (isAdmin) {
    // Admin with 0 purchased bytes = unlimited
    quotaBytes = 0;
    isUnlimited = true;
  } else {
    quotaBytes = fixedQuotaBytes + (dbUser?.storage_purchased_bytes || 0);
    isUnlimited = false;
  }

  return NextResponse.json({
    total_files: stats.totalFiles,
    total_size: stats.totalSize,
    usage_bytes: usageBytes,
    quota_bytes: quotaBytes,
    usage_percentage: isUnlimited ? 0 : (quotaBytes > 0 ? (usageBytes / quotaBytes) * 100 : 0),
    is_unlimited: isUnlimited,
  });
}
