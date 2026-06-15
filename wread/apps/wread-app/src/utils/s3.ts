/**
 * WRead S3 Storage Stub
 * Original S3/R2 code is preserved but not used.
 * All storage operations are routed through wread-storage.ts (local filesystem).
 * This file is kept as a no-op stub to prevent import errors.
 */

export const s3Storage = {
  getClient: () => null,
  getDownloadSignedUrl: async () => '',
  getUploadSignedUrl: async () => '',
  putObject: async () => {},
  deleteObject: async () => {},
  headObject: async () => null,
  copyObject: async () => {},
};

export const s3Client = null;
