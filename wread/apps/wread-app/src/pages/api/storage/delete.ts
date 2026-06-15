/**
 * WRead Storage Delete API Route
 * DELETE /api/storage/delete?fileKey=... - Delete a single file
 * Rewritten to use local SQLite + filesystem instead of Supabase + S3.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { validateUserAndToken } from '@/utils/wread-auth';
import { deleteFile, getFileByKey } from '@/utils/wread-db';
import { localStorage } from '@/utils/wread-storage';
import { corsAllMethods, runMiddleware } from '@/utils/cors';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await runMiddleware(req, res, corsAllMethods);

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user } = await validateUserAndToken(req.headers['authorization']);
    if (!user) {
      return res.status(403).json({ error: 'Not authenticated' });
    }

    const userId = (user as Record<string, unknown>).id as string;
    const { fileKey } = req.query;

    if (!fileKey || typeof fileKey !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid fileKey' });
    }

    // Check file exists and belongs to user
    const fileRecord = getFileByKey(fileKey);
    if (!fileRecord || fileRecord.user_id !== userId) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete from local storage
    try {
      await localStorage.deleteObject(fileKey);
    } catch (error) {
      console.warn('File not found in storage (may already be deleted):', error);
    }

    // Delete from database (soft delete)
    deleteFile(userId, fileKey);

    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
