/**
 * WRead Storage Type Resolver
 * Always returns 'local' since WRead uses local filesystem storage.
 */

type ObjectStorageType = 'local' | 'r2' | 's3';

export const getStorageType = (): ObjectStorageType => {
  // WRead always uses local storage
  return 'local';
};
