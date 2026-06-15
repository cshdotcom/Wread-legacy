/**
 * WRead Translation Proxy API Route
 * POST /api/deepl/translate
 *
 * When LIBRETRANSLATE_URL is set, proxies to LibreTranslate.
 * Falls back to DeepL API when DEEPL_FREE_API_KEYS or DEEPL_PRO_API_KEYS are set.
 * Maintains the same request/response format as the original DeepL API for frontend compatibility.
 */
import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { corsAllMethods, runMiddleware } from '@/utils/cors';
import { validateUserAndToken } from '@/utils/wread-auth';
import { getDailyTranslationPlanData, getSubscriptionPlan } from '@/utils/access';
import { ErrorCodes } from '@/services/translators';

const LIBRETRANSLATE_URL = process.env['LIBRETRANSLATE_URL'] || '';
const LIBRETRANSLATE_API_KEY = process.env['LIBRETRANSLATE_API_KEY'] || '';
const DEFAULT_DEEPL_FREE_API = 'https://api-free.deepl.com/v2/translate';
const DEFAULT_DEEPL_PRO_API = 'https://api.deepl.com/v2/translate';

// In-memory translation cache (used when Cloudflare KV is unavailable)
const translationCache = new Map<string, { result: string; expires: number }>();

// In-memory daily usage tracking per user
const dailyUsageMap = new Map<string, { count: number; date: string }>();

function generateCacheKey(text: string, sourceLang: string, targetLang: string): string {
  const inputString = `${sourceLang}:${targetLang}:${text}`;
  const hash = crypto.createHash('sha1').update(inputString).digest('hex');
  return `tr:${hash}`;
}

function getDailyUsage(userId: string): number {
  const today = new Date().toISOString().split('T')[0];
  const usage = dailyUsageMap.get(userId);
  if (!usage || usage.date !== today) {
    dailyUsageMap.set(userId, { count: 0, date: today });
    return 0;
  }
  return usage.count;
}

function addDailyUsage(userId: string, chars: number): number {
  const today = new Date().toISOString().split('T')[0];
  const usage = dailyUsageMap.get(userId);
  if (!usage || usage.date !== today) {
    dailyUsageMap.set(userId, { count: chars, date: today });
    return chars;
  }
  usage.count += chars;
  return usage.count;
}

/** Call LibreTranslate API for a single text */
async function callLibreTranslate(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  // LibreTranslate uses 'auto' for auto-detection
  const source = sourceLang.toUpperCase() === 'AUTO' ? 'auto' : sourceLang.toLowerCase();
  const target = targetLang.toLowerCase();

  // Map common language codes that LibreTranslate might use differently
  const langMap: Record<string, string> = {
    'zh-hans': 'zh',
    'zh-hant': 'zh-TW',
    'pt-br': 'pt',
  };
  const mappedSource = langMap[source] || source;
  const mappedTarget = langMap[target] || target;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (LIBRETRANSLATE_API_KEY) {
    headers['Authorization'] = `Bearer ${LIBRETRANSLATE_API_KEY}`;
  }

  const response = await fetch(`${LIBRETRANSLATE_URL}/translate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      q: text,
      source: mappedSource,
      target: mappedTarget,
      format: 'text',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LibreTranslate error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.translatedText || '';
}

/** Call DeepL API for a single text */
async function callDeepLAPI(
  text: string,
  sourceLang: string,
  targetLang: string,
  apiUrl: string,
  authKey: string,
): Promise<string> {
  const LANG_V2_V1_MAP: Record<string, string> = {
    'ZH-HANS': 'ZH',
    'ZH-HANT': 'ZH-TW',
  };

  const isV2Api = apiUrl.endsWith('/v2/translate');
  const input = text.replaceAll('\n', '').trim();

  const requestBody: {
    text: string | string[];
    target_lang: string;
    source_lang?: string;
  } = {
    text: isV2Api ? [input] : input,
    source_lang: isV2Api ? sourceLang : (LANG_V2_V1_MAP[sourceLang] ?? sourceLang),
    target_lang: isV2Api ? targetLang : (LANG_V2_V1_MAP[targetLang] ?? targetLang),
  };

  if (isV2Api && requestBody.source_lang?.toUpperCase() === 'AUTO') {
    delete requestBody.source_lang;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${authKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepL API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    translations?: { text: string; detected_source_language?: string }[];
    data?: string;
  };

  if (data.translations && data.translations.length > 0) {
    return data.translations[0]!.text;
  } else if (data.data) {
    return data.data;
  }
  return '';
}

const getDeepLAPIKey = (keys: string | undefined) => {
  const keyArray = keys?.split(',') ?? [];
  return keyArray.length ? keyArray[Math.floor(Math.random() * keyArray.length)]! : '';
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  await runMiddleware(req, res, corsAllMethods);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Determine which translation backend to use
  const useLibreTranslate = !!LIBRETRANSLATE_URL;
  const hasDeepLKeys = !!(process.env['DEEPL_FREE_API_KEYS'] || process.env['DEEPL_PRO_API_KEYS']);

  if (!useLibreTranslate && !hasDeepLKeys) {
    return res.status(503).json({
      error: 'No translation service configured. Set LIBRETRANSLATE_URL or DEEPL_FREE_API_KEYS/DEEPL_PRO_API_KEYS.',
    });
  }

  // Validate user
  const { user, token } = await validateUserAndToken(req.headers['authorization']);
  if (!user || !token) {
    return res.status(401).json({ error: ErrorCodes.UNAUTHORIZED });
  }

  const userId = (user as Record<string, unknown>).id as string;
  let userPlan = 'free';
  if (token) {
    userPlan = getSubscriptionPlan(token);
  }

  const {
    text,
    source_lang: sourceLang = 'AUTO',
    target_lang: targetLang = 'EN',
    use_cache: useCache = false,
  }: { text: string[]; source_lang: string; target_lang: string; use_cache: boolean } = req.body;

  try {
    // Check daily quota
    const { quota: dailyQuota } = getDailyTranslationPlanData(token);
    const totalChars = text.reduce((sum, t) => sum + (t?.length || 0), 0);
    const currentUsage = getDailyUsage(userId);

    if (dailyQuota > 0 && currentUsage + totalChars > dailyQuota) {
      return res.status(429).json({ error: ErrorCodes.DAILY_QUOTA_EXCEEDED });
    }

    // Translate each text
    const translations = await Promise.all(
      text.map(async (singleText) => {
        if (!singleText?.trim()) {
          return { text: '', daily_usage: 0 };
        }

        // Check cache
        if (useCache) {
          const cacheKey = generateCacheKey(singleText, sourceLang, targetLang);
          const cached = translationCache.get(cacheKey);
          if (cached && cached.expires > Date.now()) {
            return { text: cached.result, daily_usage: 0 };
          }
        }

        let translatedText = '';

        if (useLibreTranslate) {
          translatedText = await callLibreTranslate(singleText, sourceLang, targetLang);
        } else {
          // Use DeepL
          const deepFreeApiUrl = process.env['DEEPL_FREE_API'] || DEFAULT_DEEPL_FREE_API;
          const deeplProApiUrl = process.env['DEEPL_PRO_API'] || DEFAULT_DEEPL_PRO_API;
          let deeplApiUrl = deepFreeApiUrl;
          if (userPlan === 'pro') deeplApiUrl = deeplProApiUrl;
          const deeplAuthKey =
            deeplApiUrl === deeplProApiUrl
              ? getDeepLAPIKey(process.env['DEEPL_PRO_API_KEYS'])
              : getDeepLAPIKey(process.env['DEEPL_FREE_API_KEYS']);
          translatedText = await callDeepLAPI(singleText, sourceLang, targetLang, deeplApiUrl, deeplAuthKey);
        }

        // Store in cache
        if (useCache) {
          const cacheKey = generateCacheKey(singleText, sourceLang, targetLang);
          translationCache.set(cacheKey, {
            result: translatedText,
            expires: Date.now() + 24 * 60 * 60 * 1000, // 24h TTL
          });
        }

        return { text: translatedText, daily_usage: 0 };
      }),
    );

    // Track usage
    const translatedCharsCount = translations.reduce((a, b) => a + (b?.text.length || 0), 0);
    const newDailyUsage = addDailyUsage(userId, totalChars + translatedCharsCount);
    translations.forEach((translation) => {
      if (translation) {
        translation.daily_usage = newDailyUsage;
      }
    });

    return res.status(200).json({ translations });
  } catch (error) {
    if (error instanceof Error && error.message.includes(ErrorCodes.DAILY_QUOTA_EXCEEDED)) {
      return res.status(429).json({ error: ErrorCodes.DAILY_QUOTA_EXCEEDED });
    }
    console.error('Error proxying translation request:', error);
    return res.status(500).json({ error: ErrorCodes.INTERNAL_SERVER_ERROR });
  }
};

export default handler;
