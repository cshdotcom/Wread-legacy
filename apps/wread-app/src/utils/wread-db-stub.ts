/**
 * WRead DB Client Stub
 * This stub is used by the client-side webpack bundle to prevent
 * Node.js-only modules (better-sqlite3, fs, path) from being included.
 * The real implementation is only used on the server side.
 */

export interface DBUser {
  id: string;
  email: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  password_hash: string;
  plan: string;
  storage_usage_bytes: number;
  storage_purchased_bytes: number;
  created_at: string;
  updated_at: string;
}

export function getDb(): never {
  throw new Error('[WRead] Database is not available on the client');
}

export function findUserByEmail(): undefined {
  return undefined;
}

export function findUserById(): undefined {
  return undefined;
}

export function createUser(): never {
  throw new Error('[WRead] Database is not available on the client');
}

export function updateUser(): undefined {
  return undefined;
}

export function deleteUser(): void {
  return;
}

export function getBooks(): Record<string, unknown>[] {
  return [];
}

export function upsertBook(): void {
  return;
}

export function getBookConfigs(): Record<string, unknown>[] {
  return [];
}

export function upsertBookConfig(): void {
  return;
}

export function getBookNotes(): Record<string, unknown>[] {
  return [];
}

export function upsertBookNote(): void {
  return;
}

export function getFiles(): Record<string, unknown>[] {
  return [];
}

export function getFileByKey(): undefined {
  return undefined;
}

export function createFile(): void {
  return;
}

export function deleteFile(): void {
  return;
}

export function getStorageStats(): { totalFiles: number; totalSize: number } {
  return { totalFiles: 0, totalSize: 0 };
}
