// @ts-nocheck
/**
 * WRead Local SQLite Database Layer
 * Replaces Supabase with a local SQLite single-file database.
 * Tables are aligned with the original Readest schema for maximum frontend compatibility.
 *
 * IMPORTANT: This module MUST only be imported from server-side code (API routes,
 * middleware, server components). It uses Node.js-only native modules (better-sqlite3,
 * path, fs) that cannot run in the browser.
 *
 * For the client bundle, next.config.mjs aliases this module to wread-db-stub.ts,
 * so these imports are never executed in the browser.
 */
import path from 'path';
import fs from 'fs';

// Conditional import: better-sqlite3 is a native Node.js addon that cannot run in the browser.
// On the server, Next.js's serverExternalPackages ensures the real module is loaded at runtime.
// On the client, this entire file is replaced by the stub via webpack alias.
let Database;
const isServer = typeof window === 'undefined' && typeof process !== 'undefined';
if (isServer) {
  try {
    Database = require('better-sqlite3');
  } catch {
    // Fallback stub for environments where better-sqlite3 is not available
    Database = class Database {
      pragma() {}
      exec() {}
      prepare() { return { get: () => undefined, all: () => [], run: () => ({ changes: 0 }) }; }
      close() {}
    };
    console.warn('[WRead] better-sqlite3 not available, using stub. Database operations will not work.');
  }
} else {
  // Browser stub — should never be reached because webpack aliases this file to the stub
  Database = class Database {
    pragma() {}
    exec() {}
    prepare() { return { get: () => undefined, all: () => [], run: () => ({ changes: 0 }) }; }
    close() {}
  };
}

const DB_PATH = process.env['WREAD_DB_PATH'] || path.join(process.cwd(), 'data', 'wread.db');

let _db = null;

export function getDb() {
  if (_db) return _db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  // Run migrations on first connection
  runMigrations(_db);

  return _db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT,
      display_name TEXT,
      avatar_url TEXT,
      password_hash TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free',
      storage_usage_bytes INTEGER NOT NULL DEFAULT 0,
      storage_purchased_bytes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS books (
      user_id TEXT NOT NULL,
      book_hash TEXT NOT NULL,
      meta_hash TEXT,
      format TEXT,
      title TEXT,
      source_title TEXT,
      author TEXT,
      "group" TEXT,
      tags TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      uploaded_at TEXT,
      progress TEXT,
      reading_status TEXT,
      group_id TEXT,
      group_name TEXT,
      metadata TEXT,
      PRIMARY KEY (user_id, book_hash),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS book_configs (
      user_id TEXT NOT NULL,
      book_hash TEXT NOT NULL,
      meta_hash TEXT,
      location TEXT,
      xpointer TEXT,
      progress TEXT,
      rsvp_position TEXT,
      search_config TEXT,
      view_settings TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      PRIMARY KEY (user_id, book_hash),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS book_notes (
      user_id TEXT NOT NULL,
      book_hash TEXT NOT NULL,
      meta_hash TEXT,
      id TEXT NOT NULL,
      type TEXT,
      cfi TEXT,
      xpointer0 TEXT,
      xpointer1 TEXT,
      text TEXT,
      style TEXT,
      color TEXT,
      note TEXT,
      page INTEGER,
      "global" INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      PRIMARY KEY (user_id, book_hash, id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      book_hash TEXT,
      file_key TEXT UNIQUE NOT NULL,
      file_size INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_files_user_id_deleted_at ON files(user_id, deleted_at);
    CREATE INDEX IF NOT EXISTS idx_files_file_key ON files(file_key);

    CREATE TABLE IF NOT EXISTS replicas (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      book_hash TEXT NOT NULL,
      replica_id TEXT NOT NULL,
      data TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS replica_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      replica_id TEXT NOT NULL,
      key_data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS book_shares (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      book_hash TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      description TEXT,
      download_count INTEGER DEFAULT 0,
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

// --- User operations ---

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

export function findUserByEmail(email: string): DBUser | undefined {
  return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as DBUser | undefined;
}

export function findUserById(id: string): DBUser | undefined {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as DBUser | undefined;
}

export function createUser(user: Omit<DBUser, 'created_at' | 'updated_at'>): DBUser {
  const stmt = getDb().prepare(`
    INSERT INTO users (id, email, username, display_name, avatar_url, password_hash, plan, storage_usage_bytes, storage_purchased_bytes)
    VALUES (@id, @email, @username, @display_name, @avatar_url, @password_hash, @plan, @storage_usage_bytes, @storage_purchased_bytes)
  `);
  const result = stmt.run(user);
  if (result.changes === 0) {
    throw new Error(`[WRead] Failed to insert user: ${user.email}`);
  }
  const created = findUserById(user.id);
  if (!created) {
    throw new Error(`[WRead] User ${user.email} was inserted but could not be retrieved. Database may not be working correctly.`);
  }
  return created;
}

export function updateUser(id: string, fields: Partial<DBUser>): DBUser | undefined {
  const allowed = ['username', 'display_name', 'avatar_url', 'password_hash', 'plan', 'storage_usage_bytes', 'storage_purchased_bytes'];
  const updates: string[] = [];
  const values: Record<string, unknown> = { id };

  for (const key of allowed) {
    if (key in fields) {
      updates.push(`${key} = @${key}`);
      values[key] = (fields as Record<string, unknown>)[key];
    }
  }

  if (updates.length === 0) return findUserById(id);

  updates.push("updated_at = datetime('now')");
  const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = @id`;
  getDb().prepare(sql).run(values);
  return findUserById(id);
}

export function deleteUser(id: string): void {
  getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
}

// --- Books operations ---

export function getBooks(userId: string, since?: string, bookHash?: string, metaHash?: string): Record<string, unknown>[] {
  let sql = 'SELECT * FROM books WHERE user_id = ?';
  const params: unknown[] = [userId];

  if (bookHash) {
    sql += ' AND book_hash = ?';
    params.push(bookHash);
  }
  if (metaHash) {
    sql += ' AND meta_hash = ?';
    params.push(metaHash);
  }
  if (since) {
    sql += ' AND (updated_at > ? OR deleted_at > ?)';
    params.push(since, since);
  }
  sql += ' ORDER BY updated_at DESC';

  return getDb().prepare(sql).all(...params) as Record<string, unknown>[];
}

export function upsertBook(userId: string, book: Record<string, unknown>): void {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM books WHERE user_id = ? AND book_hash = ?').get(userId, book.book_hash) as Record<string, unknown> | undefined;

  if (!existing) {
    db.prepare(`
      INSERT INTO books (user_id, book_hash, meta_hash, format, title, source_title, author, "group", tags, progress, reading_status, group_id, group_name, metadata, updated_at, deleted_at, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)
    `).run(
      userId, book.book_hash, (book.meta_hash as string) || null, (book.format as string) || null,
      (book.title as string) || null, (book.source_title as string) || null, (book.author as string) || null,
      (book.group as string) || null, book.tags ? JSON.stringify(book.tags) : null,
      book.progress ? JSON.stringify(book.progress) : null, (book.reading_status as string) || null,
      (book.group_id as string) || null, (book.group_name as string) || null,
      book.metadata ? JSON.stringify(book.metadata) : null,
      (book.deleted_at as string) || null, (book.uploaded_at as string) || null
    );
  } else {
    const clientUpdatedAt = book.updated_at ? new Date(book.updated_at as string).getTime() : 0;
    const serverUpdatedAt = existing.updated_at ? new Date(existing.updated_at as string).getTime() : 0;
    const clientDeletedAt = book.deleted_at ? new Date(book.deleted_at as string).getTime() : 0;
    const serverDeletedAt = existing.deleted_at ? new Date(existing.deleted_at as string).getTime() : 0;

    if (clientDeletedAt > serverDeletedAt || clientUpdatedAt > serverUpdatedAt) {
      db.prepare(`
        UPDATE books SET meta_hash=?, format=?, title=?, source_title=?, author=?, "group"=?, tags=?, progress=?, reading_status=?, group_id=?, group_name=?, metadata=?, updated_at=datetime('now'), deleted_at=?, uploaded_at=?
        WHERE user_id=? AND book_hash=?
      `).run(
        (book.meta_hash as string) || null, (book.format as string) || null, (book.title as string) || null,
        (book.source_title as string) || null, (book.author as string) || null, (book.group as string) || null,
        book.tags ? JSON.stringify(book.tags) : null,
        book.progress ? JSON.stringify(book.progress) : null, (book.reading_status as string) || null,
        (book.group_id as string) || null, (book.group_name as string) || null,
        book.metadata ? JSON.stringify(book.metadata) : null,
        (book.deleted_at as string) || null, (book.uploaded_at as string) || null,
        userId, book.book_hash as string
      );
    }
  }
}

// --- Book Configs operations ---

export function getBookConfigs(userId: string, since?: string, bookHash?: string): Record<string, unknown>[] {
  let sql = 'SELECT * FROM book_configs WHERE user_id = ?';
  const params: unknown[] = [userId];
  if (bookHash) { sql += ' AND book_hash = ?'; params.push(bookHash); }
  if (since) { sql += ' AND (updated_at > ? OR deleted_at > ?)'; params.push(since, since); }
  sql += ' ORDER BY updated_at DESC';
  return getDb().prepare(sql).all(...params) as Record<string, unknown>[];
}

export function upsertBookConfig(userId: string, config: Record<string, unknown>): void {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM book_configs WHERE user_id = ? AND book_hash = ?').get(userId, config.book_hash) as Record<string, unknown> | undefined;

  if (!existing) {
    db.prepare(`
      INSERT INTO book_configs (user_id, book_hash, meta_hash, location, xpointer, progress, rsvp_position, search_config, view_settings, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `).run(
      userId, config.book_hash, (config.meta_hash as string) || null, (config.location as string) || null,
      (config.xpointer as string) || null, config.progress ? JSON.stringify(config.progress) : null,
      (config.rsvp_position as string) || null, config.search_config ? JSON.stringify(config.search_config) : null,
      config.view_settings ? JSON.stringify(config.view_settings) : null,
      (config.deleted_at as string) || null
    );
  } else {
    const clientUpdatedAt = config.updated_at ? new Date(config.updated_at as string).getTime() : 0;
    const serverUpdatedAt = existing.updated_at ? new Date(existing.updated_at as string).getTime() : 0;
    const clientDeletedAt = config.deleted_at ? new Date(config.deleted_at as string).getTime() : 0;
    const serverDeletedAt = existing.deleted_at ? new Date(existing.deleted_at as string).getTime() : 0;

    if (clientDeletedAt > serverDeletedAt || clientUpdatedAt > serverUpdatedAt) {
      db.prepare(`
        UPDATE book_configs SET meta_hash=?, location=?, xpointer=?, progress=?, rsvp_position=?, search_config=?, view_settings=?, updated_at=datetime('now'), deleted_at=?
        WHERE user_id=? AND book_hash=?
      `).run(
        (config.meta_hash as string) || null, (config.location as string) || null, (config.xpointer as string) || null,
        config.progress ? JSON.stringify(config.progress) : null, (config.rsvp_position as string) || null,
        config.search_config ? JSON.stringify(config.search_config) : null,
        config.view_settings ? JSON.stringify(config.view_settings) : null,
        (config.deleted_at as string) || null, userId, config.book_hash as string
      );
    }
  }
}

// --- Book Notes operations ---

export function getBookNotes(userId: string, since?: string, bookHash?: string): Record<string, unknown>[] {
  let sql = 'SELECT * FROM book_notes WHERE user_id = ?';
  const params: unknown[] = [userId];
  if (bookHash) { sql += ' AND book_hash = ?'; params.push(bookHash); }
  if (since) { sql += ' AND (updated_at > ? OR deleted_at > ?)'; params.push(since, since); }
  sql += ' ORDER BY updated_at DESC';
  return getDb().prepare(sql).all(...params) as Record<string, unknown>[];
}

export function upsertBookNote(userId: string, note: Record<string, unknown>): void {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM book_notes WHERE user_id = ? AND book_hash = ? AND id = ?').get(userId, note.book_hash, note.id) as Record<string, unknown> | undefined;

  if (!existing) {
    db.prepare(`
      INSERT INTO book_notes (user_id, book_hash, meta_hash, id, type, cfi, xpointer0, xpointer1, text, style, color, note, page, "global", updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `).run(
      userId, note.book_hash, (note.meta_hash as string) || null, note.id, (note.type as string) || null,
      (note.cfi as string) || null, (note.xpointer0 as string) || null, (note.xpointer1 as string) || null,
      (note.text as string) || null, (note.style as string) || null, (note.color as string) || null,
      (note.note as string) || null, (note.page as number) || null,
      note.global ? 1 : 0, (note.deleted_at as string) || null
    );
  } else {
    const clientUpdatedAt = note.updated_at ? new Date(note.updated_at as string).getTime() : 0;
    const serverUpdatedAt = existing.updated_at ? new Date(existing.updated_at as string).getTime() : 0;
    if (clientUpdatedAt > serverUpdatedAt) {
      db.prepare(`
        UPDATE book_notes SET meta_hash=?, type=?, cfi=?, xpointer0=?, xpointer1=?, text=?, style=?, color=?, note=?, page=?, "global"=?, updated_at=datetime('now'), deleted_at=?
        WHERE user_id=? AND book_hash=? AND id=?
      `).run(
        (note.meta_hash as string) || null, (note.type as string) || null, (note.cfi as string) || null,
        (note.xpointer0 as string) || null, (note.xpointer1 as string) || null, (note.text as string) || null,
        (note.style as string) || null, (note.color as string) || null, (note.note as string) || null,
        (note.page as number) || null, note.global ? 1 : 0, (note.deleted_at as string) || null,
        userId, note.book_hash as string, note.id as string
      );
    }
  }
}

// --- Files operations ---

export function getFiles(userId: string, bookHash?: string): Record<string, unknown>[] {
  let sql = 'SELECT * FROM files WHERE user_id = ? AND deleted_at IS NULL';
  const params: unknown[] = [userId];
  if (bookHash) { sql += ' AND book_hash = ?'; params.push(bookHash); }
  return getDb().prepare(sql).all(...params) as Record<string, unknown>[];
}

export function getFileByKey(fileKey: string): Record<string, unknown> | undefined {
  return getDb().prepare('SELECT * FROM files WHERE file_key = ? AND deleted_at IS NULL').get(fileKey) as Record<string, unknown> | undefined;
}

export function createFile(file: { id: string; user_id: string; book_hash: string | null; file_key: string; file_size: number }): void {
  getDb().prepare(`
    INSERT INTO files (id, user_id, book_hash, file_key, file_size, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(file.id, file.user_id, file.book_hash, file.file_key, file.file_size);

  // Update storage usage
  getDb().prepare("UPDATE users SET storage_usage_bytes = storage_usage_bytes + ?, updated_at = datetime('now') WHERE id = ?")
    .run(file.file_size, file.user_id);
}

export function deleteFile(userId: string, fileKey: string): void {
  const file = getFileByKey(fileKey);
  if (file) {
    getDb().prepare("UPDATE files SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE file_key = ?").run(fileKey);
    getDb().prepare("UPDATE users SET storage_usage_bytes = MAX(0, storage_usage_bytes - ?), updated_at = datetime('now') WHERE id = ?")
      .run(file.file_size as number, userId);
  }
}

export function getStorageStats(userId: string): { totalFiles: number; totalSize: number } {
  const row = getDb().prepare(
    "SELECT COUNT(*) as totalFiles, COALESCE(SUM(file_size), 0) as totalSize FROM files WHERE user_id = ? AND deleted_at IS NULL"
  ).get(userId) as { totalFiles: number; totalSize: number };
  return row;
}
