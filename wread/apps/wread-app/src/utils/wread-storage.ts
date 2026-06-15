/**
 * WRead Local File Storage
 * Replaces S3/MinIO/R2 object storage with local filesystem storage.
 * Preserves the same API interface as the original s3Storage/r2Storage.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const STORAGE_ROOT = process.env['WREAD_STORAGE_PATH'] || path.join(process.cwd(), 'data', 'storage');

/** Ensure storage directories exist */
export function ensureStorageDirs(): void {
  const dirs = ['books', 'covers', 'avatars', 'temp'];
  for (const dir of dirs) {
    const fullDir = path.join(STORAGE_ROOT, dir);
    if (!fs.existsSync(fullDir)) {
      fs.mkdirSync(fullDir, { recursive: true });
    }
  }
}

/** Get the local file path for a given file key */
export function getLocalFilePath(fileKey: string): string {
  // Sanitize the file key to prevent directory traversal
  const sanitized = fileKey.replace(/\.\./g, '').replace(/\/+/g, '/');
  return path.join(STORAGE_ROOT, sanitized);
}

/** Generate a unique file key */
export function generateFileKey(userId: string, bookHash: string, filename: string): string {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  const hash = crypto.createHash('md5').update(`${userId}/${bookHash}/${filename}`).digest('hex').substring(0, 12);
  return `books/${userId}/${bookHash}/${hash}${ext}`;
}

/** Generate a cover file key */
export function generateCoverKey(userId: string, bookHash: string): string {
  return `covers/${userId}/${bookHash}.jpg`;
}

/** Generate an avatar file key */
export function generateAvatarKey(userId: string): string {
  return `avatars/${userId}.jpg`;
}

/**
 * Local storage interface compatible with s3Storage/r2Storage
 */
export const localStorage = {
  /** Save a file to local disk */
  putObject: async (fileKey: string, body: Buffer | ArrayBuffer | string, contentType?: string): Promise<void> => {
    const filePath = getLocalFilePath(fileKey);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data = body instanceof ArrayBuffer ? Buffer.from(body) : body;
    fs.writeFileSync(filePath, data);
  },

  /** Read a file from local disk */
  getObject: async (fileKey: string): Promise<Buffer | null> => {
    const filePath = getLocalFilePath(fileKey);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath);
  },

  /** Delete a file from local disk */
  deleteObject: async (fileKey: string): Promise<void> => {
    const filePath = getLocalFilePath(fileKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  },

  /** Check if a file exists and get its metadata */
  headObject: async (fileKey: string): Promise<{ size: number; lastModified: Date } | null> => {
    const filePath = getLocalFilePath(fileKey);
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    return {
      size: stat.size,
      lastModified: stat.mtime,
    };
  },

  /** Copy a file */
  copyObject: async (sourceKey: string, destKey: string): Promise<void> => {
    const srcPath = getLocalFilePath(sourceKey);
    const dstPath = getLocalFilePath(destKey);
    if (!fs.existsSync(srcPath)) throw new Error(`Source file not found: ${sourceKey}`);

    const dir = path.dirname(dstPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.copyFileSync(srcPath, dstPath);
  },

  /** Get a URL for downloading a file (relative to the server) */
  getDownloadUrl: (fileKey: string): string => {
    return `/api/local-storage/download?key=${encodeURIComponent(fileKey)}`;
  },

  /** Get a URL for uploading a file (relative to the server) */
  getUploadUrl: (fileKey: string): string => {
    return `/api/local-storage/upload?key=${encodeURIComponent(fileKey)}`;
  },

  /** Get the absolute file system path for serving static files */
  getFilePath: (fileKey: string): string => {
    return getLocalFilePath(fileKey);
  },
};

ensureStorageDirs();
