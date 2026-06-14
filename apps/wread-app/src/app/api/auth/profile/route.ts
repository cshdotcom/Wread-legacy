/**
 * WRead Auth Profile API Route
 * PATCH /api/auth/profile - Update user profile (username, display_name, avatar_url, password)
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateUserAndToken, updateUserProfile, changePassword } from '@/utils/wread-auth';

export async function PATCH(req: NextRequest) {
  const { user } = await validateUserAndToken(req.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const userId = (user as Record<string, unknown>)['id'] as string;

    // Handle password change
    if (body.password) {
      if (!body.oldPassword) {
        return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
      }
      const success = changePassword(userId, body.oldPassword, body.password);
      if (!success) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }
    }

    // Handle profile update
    const profileFields: Record<string, string> = {};
    if (body.data) {
      if (body.data.username) profileFields['username'] = body.data.username;
      if (body.data.display_name) profileFields['display_name'] = body.data.display_name;
      if (body.data.avatar_url) profileFields['avatar_url'] = body.data.avatar_url;
    }

    if (Object.keys(profileFields).length > 0) {
      const updatedUser = updateUserProfile(userId, profileFields);
      if (updatedUser) {
        return NextResponse.json({ user: updatedUser });
      }
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
