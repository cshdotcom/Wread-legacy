/**
 * WRead User Delete API Route
 * DELETE /api/user/delete - Delete the current user account
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateUserAndToken } from '@/utils/wread-auth';
import { deleteUser } from '@/utils/wread-db';

export async function DELETE(req: NextRequest) {
  const { user } = await validateUserAndToken(req.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const userId = (user as Record<string, unknown>)['id'] as string;
    deleteUser(userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('User delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
