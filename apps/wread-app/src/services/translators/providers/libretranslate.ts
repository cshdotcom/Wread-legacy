import { stubTranslation as _ } from '@/utils/misc';
import { TranslationProvider } from '../types';

/**
 * LibreTranslate provider for self-hosted translation.
 * The URL is configured via LIBRETRANSLATE_URL env var (server-side).
 * The client calls /api/libretranslate/translate which proxies to the
 * configured LibreTranslate instance.
 */
export const libretranslateProvider: TranslationProvider = {
  name: 'libretranslate',
  label: _('云翻译'),
  authRequired: false,
  translate: async (
    texts: string[],
    sourceLang: string,
    targetLang: string,
    token?: string | null,
  ): Promise<string[]> => {
    if (!texts.length) return [];

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('/api/libretranslate/translate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: texts,
        source_lang: sourceLang || 'auto',
        target_lang: targetLang,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `Translation failed: ${response.status}`);
    }

    const data = await response.json();
    // Support both single text and array responses
    if (data.translated_text) {
      if (Array.isArray(data.translated_text)) {
        return data.translated_text;
      }
      // Single text was sent, return as array
      return [data.translated_text];
    }
    return texts; // Fallback: return originals
  },
};
