/**
 * WRead Runtime Configuration
 * Replaces Supabase URL/key with local WRead configuration.
 */
export interface WReadRuntimeConfig {
  apiBaseUrl?: string;
  objectStorageType?: string;
  storageFixedQuota?: number;
  translationFixedQuota?: number;
  libreTranslateUrl?: string;
}

declare global {
  interface Window {
    __WREAD_RUNTIME_CONFIG?: WReadRuntimeConfig;
  }
}

export const getRuntimeConfig = () =>
  typeof window === 'undefined' ? undefined : window.__WREAD_RUNTIME_CONFIG;

export const getServerRuntimeConfig = (): WReadRuntimeConfig => ({
  apiBaseUrl:
    process.env['API_BASE_URL'] ??
    process.env['NEXT_PUBLIC_API_BASE_URL'] ??
    process.env['SITE_URL'],
  objectStorageType: 'local', // Always local in WRead
  storageFixedQuota: (() => {
    const raw = process.env['STORAGE_FIXED_QUOTA'] ?? process.env['NEXT_PUBLIC_STORAGE_FIXED_QUOTA'];
    return raw ? parseInt(raw, 10) : undefined;
  })(),
  translationFixedQuota: (() => {
    const raw = process.env['TRANSLATION_FIXED_QUOTA'] ?? process.env['NEXT_PUBLIC_TRANSLATION_FIXED_QUOTA'];
    return raw ? parseInt(raw, 10) : undefined;
  })(),
  libreTranslateUrl:
    process.env['LIBRETRANSLATE_URL'] ?? process.env['NEXT_PUBLIC_LIBRETRANSLATE_URL'],
});

// Keep backward compatible export name for existing code that references ReadestRuntimeConfig
export type ReadestRuntimeConfig = WReadRuntimeConfig;
