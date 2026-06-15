/**
 * WRead Local Storage Download API Route
 * GET /api/local-storage/download?key=... - Download a file from local storage
 */
import { NextRequest, NextResponse } from 'next/server';
import { localStorage } from '@/utils/wread-storage';

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
  }

  try {
    const data = await localStorage.getObject(key);
    if (!data) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Determine content type from file extension
    const ext = key.split('.').pop()?.toLowerCase() || '';
    const contentTypes: Record<string, string> = {
      epub: 'application/epub+zip',
      pdf: 'application/pdf',
      mobi: 'application/x-mobipocket-ebook',
      azw3: 'application/vnd.amazon.mobi8-ebook',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${key.split('/').pop()}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
