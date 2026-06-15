/**
 * WRead Dictionary Lookup Proxy API Route
 * GET /api/dictionary/lookup?word=...&lang=...&provider=...
 *
 * Proxies dictionary lookups to avoid CORS issues in self-hosted deployments.
 * Currently supports Wiktionary and Wikipedia APIs.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const word = req.nextUrl.searchParams.get('word');
  const provider = req.nextUrl.searchParams.get('provider') || 'wiktionary';
  const lang = req.nextUrl.searchParams.get('lang') || 'en';

  if (!word) {
    return NextResponse.json({ error: 'word parameter is required' }, { status: 400 });
  }

  try {
    if (provider === 'wiktionary') {
      // Wiktionary REST API
      const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'WRead/1.0 (Dictionary Lookup)',
          'Accept': 'application/json',
        },
      });
      if (!response.ok) {
        return NextResponse.json({ error: `Wiktionary API error: ${response.status}` }, { status: response.status });
      }
      const data = await response.json();
      return NextResponse.json(data, {
        headers: { 'Cache-Control': 'public, max-age=3600' },
      });
    }

    if (provider === 'wiktionary-wikitext') {
      // Wiktionary wikitext API (for Chinese character lookups)
      const url = `https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&prop=wikitext&format=json`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'WRead/1.0 (Dictionary Lookup)',
        },
      });
      if (!response.ok) {
        return NextResponse.json({ error: `Wiktionary API error: ${response.status}` }, { status: response.status });
      }
      const data = await response.json();
      return NextResponse.json(data, {
        headers: { 'Cache-Control': 'public, max-age=3600' },
      });
    }

    if (provider === 'wikipedia') {
      // Wikipedia summary API
      const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(word)}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'WRead/1.0 (Dictionary Lookup)',
          'Accept': 'application/json',
        },
      });
      if (!response.ok) {
        return NextResponse.json({ error: `Wikipedia API error: ${response.status}` }, { status: response.status });
      }
      const data = await response.json();
      return NextResponse.json(data, {
        headers: { 'Cache-Control': 'public, max-age=3600' },
      });
    }

    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
  } catch (error) {
    console.error('Dictionary lookup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
