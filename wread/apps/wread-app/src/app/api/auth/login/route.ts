/**
 * WRead Login API Route
 * POST /api/auth/login - Authenticate with email/password, returns JWT token
 */
import { NextRequest, NextResponse } from 'next/server';
import { loginWithEmail, ensureAdminUser } from '@/utils/wread-auth';

// Initialize admin user on first request
let adminInitialized = false;
if (!adminInitialized) {
  ensureAdminUser();
  adminInitialized = true;
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const result = loginWithEmail(email, password);
    if (!result) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    return NextResponse.json({
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
