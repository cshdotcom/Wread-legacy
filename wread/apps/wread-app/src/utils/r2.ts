/**
 * WRead R2 Storage Stub
 * Original Cloudflare R2 code is preserved but not used.
 * All storage operations are routed through wread-storage.ts (local filesystem).
 * This file is kept as a no-op stub to prevent import errors.
 */

export const r2Storage = {
  getR2Client: () => null,
  getR2Url: () => '',
  getDownloadSignedUrl: async () => '',
  getUploadSignedUrl: async () => '',
  putObject: async () => {},
  deleteObject: async () => {},
  headObject: async () => null,
  copyObject: async () => {},
};
