/**
 * WRead Auth Client Stub
 * This stub is used by the client-side webpack bundle to prevent
 * Node.js-only modules from being included.
 * The real implementation is only used on the server side.
 */

export function toSupabaseCompatibleUser(): Record<string, unknown> {
  return {};
}

export function issueToken(): string {
  return '';
}

export function verifyToken(): null {
  return null;
}

export function loginWithEmail(): null {
  return null;
}

export function registerUser(): null {
  return null;
}

export function updateUserProfile(): null {
  return null;
}

export function changePassword(): false {
  return false;
}

export async function validateUserAndToken(): Promise<{ user?: Record<string, unknown>; token?: string }> {
  return {};
}

export function ensureAdminUser(): void {
  return;
}
