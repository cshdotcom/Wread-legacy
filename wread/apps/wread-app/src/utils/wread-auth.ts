/**
 * WRead Local JWT Authentication
 * Replaces GoTrue/Supabase Auth with local JWT-based authentication.
 * Issues JWTs that are compatible with the existing frontend AuthContext.
 */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { findUserByEmail, findUserById, createUser, updateUser, type DBUser } from './wread-db';

const JWT_SECRET = process.env['WREAD_JWT_SECRET'] || 'wread-default-jwt-secret-change-me-in-production';
const JWT_EXPIRY = process.env['WREAD_JWT_EXPIRY'] || '7d';

export interface WReadUser {
  id: string;
  email: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  plan: string;
}

export interface WReadTokenPayload {
  sub: string;
  email: string;
  plan: string;
  storage_usage_bytes: number;
  storage_purchased_bytes: number;
  iat: number;
  exp: number;
}

/** Convert DBUser to the format expected by frontend (compatible with Supabase User) */
export function toSupabaseCompatibleUser(dbUser: DBUser): Record<string, unknown> {
  return {
    id: dbUser.id,
    email: dbUser.email,
    user_metadata: {
      username: dbUser.username,
      display_name: dbUser.display_name,
      avatar_url: dbUser.avatar_url,
    },
    app_metadata: {
      plan: dbUser.plan,
    },
    aud: 'authenticated',
    role: 'authenticated',
    created_at: dbUser.created_at,
    updated_at: dbUser.updated_at,
  };
}

/** Issue a JWT token compatible with the original Supabase token format */
export function issueToken(dbUser: DBUser): string {
  const payload: Omit<WReadTokenPayload, 'iat' | 'exp'> = {
    sub: dbUser.id,
    email: dbUser.email,
    plan: dbUser.plan,
    storage_usage_bytes: dbUser.storage_usage_bytes,
    storage_purchased_bytes: dbUser.storage_purchased_bytes,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/** Verify a JWT token and return the payload */
export function verifyToken(token: string): WReadTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as WReadTokenPayload;
  } catch {
    return null;
  }
}

/** Login with email and password */
export function loginWithEmail(email: string, password: string): { user: Record<string, unknown>; token: string } | null {
  const dbUser = findUserByEmail(email);
  if (!dbUser) return null;

  const valid = bcrypt.compareSync(password, dbUser.password_hash);
  if (!valid) return null;

  const token = issueToken(dbUser);
  const user = toSupabaseCompatibleUser(dbUser);
  return { user, token };
}

/** Register a new user (disabled by default, admin only) */
export function registerUser(email: string, password: string, username?: string): { user: Record<string, unknown>; token: string } | null {
  const existing = findUserByEmail(email);
  if (existing) return null;

  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);

  const dbUser = createUser({
    id,
    email,
    username: username || null,
    display_name: username || null,
    avatar_url: null,
    password_hash: passwordHash,
    plan: 'free',
    storage_usage_bytes: 0,
    storage_purchased_bytes: 0,
  });

  const token = issueToken(dbUser);
  const user = toSupabaseCompatibleUser(dbUser);
  return { user, token };
}

/** Update user profile */
export function updateUserProfile(userId: string, fields: { username?: string; display_name?: string; avatar_url?: string }): Record<string, unknown> | null {
  const updated = updateUser(userId, fields);
  if (!updated) return null;
  return toSupabaseCompatibleUser(updated);
}

/** Change password */
export function changePassword(userId: string, oldPassword: string, newPassword: string): boolean {
  const dbUser = findUserById(userId);
  if (!dbUser) return false;

  const valid = bcrypt.compareSync(oldPassword, dbUser.password_hash);
  if (!valid) return false;

  const newHash = bcrypt.hashSync(newPassword, 10);
  updateUser(userId, { password_hash: newHash });
  return true;
}

/** Validate user and token from Authorization header - drop-in replacement for validateUserAndToken */
export async function validateUserAndToken(authHeader: string | null | undefined): Promise<{ user: Record<string, unknown>; token: string } | {}> {
  if (!authHeader) return {};

  const token = authHeader.replace('Bearer ', '');
  const payload = verifyToken(token);
  if (!payload) return {};

  const dbUser = findUserById(payload.sub);
  if (!dbUser) return {};

  return {
    user: toSupabaseCompatibleUser(dbUser),
    token,
  };
}

/** Initialize admin user from environment variables if not exists */
export function ensureAdminUser(): void {
  const adminEmail = process.env['WREAD_ADMIN_EMAIL'] || 'admin@wread.local';
  const adminPassword = process.env['WREAD_ADMIN_PASSWORD'] || 'admin';

  const existing = findUserByEmail(adminEmail);
  if (!existing) {
    registerUser(adminEmail, adminPassword, 'admin');
    // Upgrade admin to pro plan
    const user = findUserByEmail(adminEmail);
    if (user) {
      updateUser(user.id, { plan: 'pro' });
    }
    console.log(`[WRead] Admin user created: ${adminEmail}`);
  }
}
