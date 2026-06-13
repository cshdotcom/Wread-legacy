/**
 * WRead LibreTranslate Proxy API Route
 * POST /api/libretranslate/translate - Proxy translation requests to LibreTranslate
 * Replaces DeepL server proxy for self-hosted translation.
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateUserAndToken } from '@/utils/wread-auth';
import { getDailyTranslationPlanData } from '@/utils/access';

const LIBRETRANSLATE_URL = process.env['LIBRETRANSLATE_URL'] || '';
const LIBRETRANSLATE_API_KEY = process.env['LIBRETRANSLATE_API_KEY'] || '';

// Simple in-memory cache for translations
const translationCache = new Map<string, { result: string; expires: number }>();

function getCacheKey(text: string, source: string, target: string): string {
  const { createHash } = require('crypto');
  return createHash('sha1').update(`${source}:${target}:${text}`).digest('hex');
}

// Track daily usage per user
const dailyUsageMap = new Map<string, { count: number; date: string }>();

function getDailyUsage(userId: string): number {
  const today = new Date().toISOString().split('T')[0];
  const usage = dailyUsageMap.get(userId);
  if (!usage || usage.date !== today) {
    dailyUsageMap.set(userId, { count: 0, date: today });
    return 0;
  }
  return usage.count;
}

function addDailyUsage(userId: string, chars: number): void {
  const today = new Date().toISOString().split('T')[0];
  const usage = dailyUsageMap.get(userId);
  if (!usage || usage.date !== today) {
    dailyUsageMap.set(userId, { count: chars, date: today });
  } else {
    usage.count += chars;
  }
}

export async function POST(req: NextRequest) {
  if (!LIBRETRANSLATE_URL) {
    return NextResponse.json(
      { error: 'LibreTranslate is not configured. Set LIBRETRANSLATE_URL environment variable.' },
      { status: 503 },
    );
  }

  const { user, token } = await validateUserAndToken(req.headers.get('authorization'));
  if (!user || !token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { text, source_lang, target_lang } = body;

    if (!text || !target_lang) {
      return NextResponse.json({ error: 'text and target_lang are required' }, { status: 400 });
    }

    // Check daily quota
    const userId = (user as Record<string, unknown>).id as string;
    const { quota: dailyQuota } = getDailyTranslationPlanData(token);
    const currentUsage = getDailyUsage(userId);
    const chars = typeof text === 'string' ? text.length : JSON.stringify(text).length;

    if (dailyQuota > 0 && currentUsage + chars > dailyQuota) {
      return NextResponse.json({ error: 'Daily translation quota exceeded' }, { status: 429 });
    }

    // Check cache
    const cacheKey = getCacheKey(
      typeof text === 'string' ? text : JSON.stringify(text),
      source_lang || 'auto',
      target_lang,
    );
    const cached = translationCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      addDailyUsage(userId, 0); // Cache hit doesn't count
      return NextResponse.json({ translated_text: cached.result, cached: true });
    }

    // Call LibreTranslate
    const response = await fetch(`${LIBRETRANSLATE_URL}/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(LIBRETRANSLATE_API_KEY ? { Authorization: `Bearer ${LIBRETRANSLATE_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        q: text,
        source: source_lang || 'auto',
        target: target_lang,
        format: 'text',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('LibreTranslate error:', errText);
      return NextResponse.json(
        { error: `LibreTranslate error: ${response.status}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    const translatedText = data.translatedText || '';

    // Cache result for 24 hours
    translationCache.set(cacheKey, {
      result: translatedText,
      expires: Date.now() + 24 * 60 * 60 * 1000,
    });

    // Track usage
    addDailyUsage(userId, chars);

    return NextResponse.json({ translated_text: translatedText, cached: false });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
