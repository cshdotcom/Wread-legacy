/**
 * WRead Storage Purge (Bulk Delete) API Route
 * DELETE /api/storage/purge - Delete multiple files at once
 * Rewritten to use local SQLite + filesystem instead of Supabase + S3.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { validateUserAndToken } from '@/utils/wread-auth';
import { deleteFile, getFileByKey } from '@/utils/wread-db';
import { localStorage } from '@/utils/wread-storage';
import { corsAllMethods, runMiddleware } from '@/utils/cors';

interface BulkDeleteResult {
  success: string[];
  failed: Array<{ fileKey: string; error: string }>;
  deletedCount: number;
  failedCount: number;
}

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
    const { fileKeys } = req.body;

    if (!fileKeys || !Array.isArray(fileKeys)) {
      return res.status(400).json({ error: 'Missing or invalid fileKeys array' });
    }

    if (fileKeys.length === 0) {
      return res.status(400).json({ error: 'fileKeys array cannot be empty' });
    }

    if (fileKeys.length > 100) {
      return res.status(400).json({ error: 'Cannot delete more than 100 files at once' });
    }

    const success: string[] = [];
    const failed: Array<{ fileKey: string; error: string }> = [];

    for (const fileKey of fileKeys) {
      if (typeof fileKey !== 'string') {
        failed.push({ fileKey: String(fileKey), error: 'Invalid fileKey type' });
        continue;
      }

      try {
        const fileRecord = getFileByKey(fileKey);
        if (!fileRecord || fileRecord.user_id !== userId) {
          failed.push({ fileKey, error: 'File not found or already deleted' });
          continue;
        }

        // Delete from local storage
        try {
          await localStorage.deleteObject(fileKey);
        } catch {
          // File may already be gone from storage, that's OK
        }

        // Soft delete from database
        deleteFile(userId, fileKey);
        success.push(fileKey);
      } catch (error) {
        failed.push({
          fileKey,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const response: BulkDeleteResult = {
      success,
      failed,
      deletedCount: success.length,
      failedCount: failed.length,
    };

    const statusCode =
      failed.length > 0 && success.length > 0 ? 207 : failed.length > 0 ? 500 : 200;

    return res.status(statusCode).json(response);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
