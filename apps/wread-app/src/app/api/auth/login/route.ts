/**
 * WRead Login API Route
 * POST /api/auth/login - Authenticate with email/password, returns JWT token
 */
import { NextRequest, NextResponse } from 'next/server';
import { loginWithEmail, ensureAdminUser } from '@/utils/wread-auth';

// Lazy initialization - only runs on first request, not during build
let adminInitialized = false;

function ensureAdmin(): void {
  if (adminInitialized) return;
  try {
    ensureAdminUser();
  } catch (e) {
    console.error('[WRead] Admin init failed:', e);
  }
  adminInitialized = true;
}

export async function POST(req: NextRequest) {
  ensureAdmin();

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
