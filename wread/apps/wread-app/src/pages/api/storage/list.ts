/**
 * WRead Storage List API Route
 * GET /api/storage/list - List files for the authenticated user
 * Rewritten to use local SQLite instead of Supabase.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { validateUserAndToken } from '@/utils/wread-auth';
import { getFiles } from '@/utils/wread-db';
import { corsAllMethods, runMiddleware } from '@/utils/cors';

interface FileRecord {
  file_key: string;
  file_size: number;
  book_hash: string | null;
  created_at: string;
  updated_at: string | null;
}

interface ListFilesResponse {
  files: FileRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await runMiddleware(req, res, corsAllMethods);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user } = await validateUserAndToken(req.headers['authorization']);
    if (!user) {
      return res.status(403).json({ error: 'Not authenticated' });
    }

    const userId = (user as Record<string, unknown>).id as string;
    const reqQuery = req.query as {
      page?: string;
      pageSize?: string;
      bookHash?: string;
    };
    const page = parseInt(reqQuery.page as string) || 1;
    const pageSize = Math.min(parseInt(reqQuery.pageSize as string) || 50, 100);
    const bookHash = reqQuery.bookHash as string | undefined;

    // Get files from local DB
    const allFiles = getFiles(userId, bookHash) as FileRecord[];

    const total = allFiles.length;
    const totalPages = Math.ceil(total / pageSize);
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    const paginatedFiles = allFiles.slice(from, to);

    const response: ListFilesResponse = {
      files: paginatedFiles,
      total,
      page,
      pageSize,
      totalPages,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
