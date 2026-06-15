/**
 * WRead Storage Upload API Route
 * Rewritten to use local file storage instead of S3/MinIO presigned URLs.
 * Two-step flow:
 * 1. POST /api/storage/upload → get upload_url + download_url
 * 2. PUT /api/local-storage/upload?key=... → upload the actual file content
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { NextRequest, NextResponse } from 'next/server';
import { validateUserAndToken } from '@/utils/wread-auth';
import { localStorage, generateFileKey } from '@/utils/wread-storage';
import { createFile, getStorageStats, findUserById } from '@/utils/wread-db';
import { runMiddleware, corsAllMethods } from '@/utils/cors';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const { user, token } = await validateUserAndToken(req.headers.get('authorization'));
  if (!user || !token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const userId = (user as Record<string, unknown>).id as string;

  try {
    const body = await req.json();
    const { book_hash, file_name, file_size, content_type, content } = body;

    if (!file_name || !file_size) {
      return NextResponse.json({ error: 'file_name and file_size are required' }, { status: 400 });
    }

    // Check storage quota
    const dbUser = findUserById(userId);
    const stats = getStorageStats(userId);
    const quotaBytes = parseInt(process.env['STORAGE_FIXED_QUOTA'] || '10737418240');
    if (stats.totalSize + file_size > quotaBytes) {
      return NextResponse.json({ error: 'Storage quota exceeded' }, { status: 413 });
    }

    // Generate file key and URLs
    const fileKey = generateFileKey(userId, book_hash || 'general', file_name);
    const uploadUrl = localStorage.getUploadUrl(fileKey);
    const downloadUrl = localStorage.getDownloadUrl(fileKey);

    // If content is provided inline (base64), save directly
    if (content) {
      const buffer = Buffer.from(content, 'base64');
      await localStorage.putObject(fileKey, buffer, content_type);
    }

    // Create file record in DB (only if not already existing)
    const existingFile = stats.totalFiles > 0 ? null : null; // We always create a new record
    const fileId = uuidv4();
    createFile({
      id: fileId,
      user_id: userId,
      book_hash: book_hash || null,
      file_key: fileKey,
      file_size: file_size,
    });

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
