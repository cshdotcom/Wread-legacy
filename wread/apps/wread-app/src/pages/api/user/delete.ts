/**
 * WRead User Delete API Route
 * DELETE /api/user/delete - Delete the authenticated user and all their data
 * Rewritten to use local SQLite instead of Supabase.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { corsAllMethods, runMiddleware } from '@/utils/cors';
import { validateUserAndToken } from '@/utils/wread-auth';
import { deleteUser } from '@/utils/wread-db';

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
    deleteUser(userId);

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
