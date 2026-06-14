import { NextRequest, NextResponse } from 'next/server';

const allowedOrigins = [
  'https://web.wread.com',
  'https://tauri.localhost',
  'http://tauri.localhost',
  'http://localhost:3000',
  'http://localhost:3001',
  'tauri://localhost',
];

const corsOptions = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

export function middleware(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith('/api/');

  if (isApi) {
    const origin = request.headers.get('origin') ?? '';
    const isAllowedOrigin = allowedOrigins.includes(origin);

    if (request.method === 'OPTIONS') {
      const preflightHeaders = new Headers({
        ...corsOptions,
        ...(isAllowedOrigin && { 'Access-Control-Allow-Origin': origin }),
      });

      return new NextResponse(null, {
        status: 200,
        headers: preflightHeaders,
      });
    }

    const response = NextResponse.next();

    if (isAllowedOrigin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }

    Object.entries(corsOptions).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }

  // WRead: No need for Cross-Origin isolation since we don't use Turso WASM
  const response = NextResponse.next();
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json).*)'],
};
