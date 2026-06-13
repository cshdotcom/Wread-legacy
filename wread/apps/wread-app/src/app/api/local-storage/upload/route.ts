/**
 * WRead Local Storage Upload API Route
 * POST /api/local-storage/upload - Upload a file to local storage
 * PUT /api/local-storage/upload?key=... - Direct file upload
 */
import { NextRequest, NextResponse } from 'next/server';
import { localStorage, generateFileKey, generateCoverKey, generateAvatarKey } from '@/utils/wread-storage';
import { validateUserAndToken } from '@/utils/wread-auth';
import { createFile, getStorageStats } from '@/utils/wread-db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const { user } = await validateUserAndToken(req.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const userId = (user as Record<string, unknown>).id as string;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const bookHash = formData.get('book_hash') as string | null;
    const fileType = formData.get('type') as string || 'book';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Check storage quota
    const stats = getStorageStats(userId);
    const quotaBytes = parseInt(process.env['STORAGE_FIXED_QUOTA'] || '1073741824'); // 1GB default
    if (stats.totalSize + file.size > quotaBytes) {
      return NextResponse.json({ error: 'Storage quota exceeded' }, { status: 413 });
    }

    // Generate file key
    let fileKey: string;
    if (fileType === 'cover') {
      fileKey = generateCoverKey(userId, bookHash || 'unknown');
    } else if (fileType === 'avatar') {
      fileKey = generateAvatarKey(userId);
    } else {
      fileKey = generateFileKey(userId, bookHash || 'general', file.name);
    }

    // Save file
    const buffer = Buffer.from(await file.arrayBuffer());
    await localStorage.putObject(fileKey, buffer);

    // Record in database
    const fileId = uuidv4();
    createFile({
      id: fileId,
      user_id: userId,
      book_hash: bookHash,
      file_key: fileKey,
      file_size: file.size,
    });

    // Return the download URL in the same format as the original S3 upload API
    const downloadUrl = localStorage.getDownloadUrl(fileKey);

    return NextResponse.json({
      id: fileId,
      file_key: fileKey,
      download_url: downloadUrl,
      upload_url: localStorage.getUploadUrl(fileKey),
      file_size: file.size,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Direct PUT upload for large files (alternative upload method) */
export async function PUT(req: NextRequest) {
  const { user } = await validateUserAndToken(req.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const key = req.nextUrl.searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
  }

  try {
    const body = await req.arrayBuffer();
    await localStorage.putObject(key, Buffer.from(body));

    return NextResponse.json({ success: true, key });
  } catch (error) {
    console.error('Upload PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
