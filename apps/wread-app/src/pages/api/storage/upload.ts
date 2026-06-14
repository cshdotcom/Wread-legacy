// @ts-nocheck
/**
 * WRead Storage Upload API Route
 * Rewritten to use local file storage instead of S3/MinIO presigned URLs.
 * Frontend uploads go directly to /api/local-storage/upload
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { NextRequest, NextResponse } from 'next/server';
import { validateUserAndToken } from '@/utils/wread-auth';
import { localStorage, generateFileKey } from '@/utils/wread-storage';
import { createFile, getStorageStats, findUserById, updateUser } from '@/utils/wread-db';
import { runMiddleware, corsAllMethods } from '@/utils/cors';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const { user } = await validateUserAndToken(req.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const userId = (user as Record<string, unknown>).id as string;

  try {
    const body = await req.json();
    const { book_hash, file_name, file_size, content_type } = body;

    if (!file_name || !file_size) {
      return NextResponse.json({ error: 'file_name and file_size are required' }, { status: 400 });
    }

    // Check storage quota
    const dbUser = findUserById(userId);
    const stats = getStorageStats(userId);
    const quotaBytes = parseInt(process.env['STORAGE_FIXED_QUOTA'] || '1073741824');
    if (stats.totalSize + file_size > quotaBytes) {
      return NextResponse.json({ error: 'Storage quota exceeded' }, { status: 413 });
    }

    // Generate file key and upload URL
    const fileKey = generateFileKey(userId, book_hash || 'general', file_name);
    const uploadUrl = localStorage.getUploadUrl(fileKey);
    const downloadUrl = localStorage.getDownloadUrl(fileKey);

    // Create file record
    const fileId = uuidv4();
    createFile({
      id: fileId,
      user_id: userId,
      book_hash: book_hash || null,
      file_key: fileKey,
      file_size: file_size,
    });

    // Return in the same format as original upload API (with presigned URL replaced by local URL)
    return NextResponse.json({
      id: fileId,
      file_key: fileKey,
      upload_url: uploadUrl,
      download_url: downloadUrl,
      file_size,
    });
  } catch (error) {
    console.error('Storage upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!req.url) return res.status(400).json({ error: 'Invalid request URL' });
  const protocol = process.env['PROTOCOL'] || 'http';
  const host = process.env['HOST'] || 'localhost:3000';
  const url = new URL(req.url, `${protocol}://${host}`);
  await runMiddleware(req, res, corsAllMethods);

  try {
    const nextReq = new NextRequest(url.toString(), {
      headers: new Headers(req.headers as Record<string, string>),
      method: 'POST',
      body: JSON.stringify(req.body),
    });
    const response = await POST(nextReq);
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
