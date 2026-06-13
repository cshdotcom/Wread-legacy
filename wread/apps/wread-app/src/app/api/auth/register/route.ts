/**
 * WRead Register API Route
 * POST /api/auth/register - Register a new user (requires admin JWT)
 * Self-registration is disabled by default for self-hosted single-user mode.
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateUserAndToken, registerUser } from '@/utils/wread-auth';

export async function POST(req: NextRequest) {
  // Check if self-registration is explicitly enabled
  const allowSelfRegister = process.env['WREAD_ALLOW_SELF_REGISTER'] === 'true';

  if (!allowSelfRegister) {
    // Require admin authorization
    const { user } = await validateUserAndToken(req.headers.get('authorization'));
    if (!user) {
      return NextResponse.json(
        { error: 'Registration requires admin authorization. Set WREAD_ALLOW_SELF_REGISTER=true to allow self-registration.' },
        { status: 403 },
      );
    }
  }

  try {
    const { email, password, username } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const result = registerUser(email, password, username);
    if (!result) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    return NextResponse.json({
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
