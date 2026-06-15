/**
 * WRead Local Storage Upload API Route
 * POST /api/local-storage/upload?key=... - Upload a file to local storage
 * PUT /api/local-storage/upload?key=... - Upload a file to local storage (alternative method)
 *
 * This replaces the S3 presigned URL upload flow.
 * The frontend can either:
 * 1. POST with JSON body { key, content (base64), content_type }
 * 2. PUT with raw binary body and ?key=... query param
 */
import { NextRequest, NextResponse } from 'next/server';
import { localStorage } from '@/utils/wread-storage';
import { validateUserAndToken } from '@/utils/wread-auth';

export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  const contentType = req.headers.get('content-type') || '';

  try {
    // For JSON body: { key, content (base64), content_type }
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const fileKey = body.key || key;
      if (!fileKey) {
        return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
      }

      // Validate auth
      const { user } = await validateUserAndToken(req.headers.get('authorization'));
      if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }

      // Decode base64 content
      const contentBase64 = body.content;
      if (!contentBase64) {
        return NextResponse.json({ error: 'Missing content' }, { status: 400 });
      }
      const buffer = Buffer.from(contentBase64, 'base64');

      await localStorage.putObject(fileKey, buffer, body.content_type);
      return NextResponse.json({ success: true, key: fileKey, size: buffer.length });
    }

    // For multipart/form-data (file upload)
    if (contentType.includes('multipart/form-data')) {
      const { user } = await validateUserAndToken(req.headers.get('authorization'));
      if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }

      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const fileKey = formData.get('key') as string || key;

      if (!file || !fileKey) {
        return NextResponse.json({ error: 'Missing file or key' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      await localStorage.putObject(fileKey, buffer, file.type);

      return NextResponse.json({ success: true, key: fileKey, size: buffer.length });
    }

    // For raw binary body (PUT-style via POST)
    if (key) {
      const { user } = await validateUserAndToken(req.headers.get('authorization'));
      if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }

      const buffer = Buffer.from(await req.arrayBuffer());
      await localStorage.putObject(key, buffer, contentType || undefined);

      return NextResponse.json({ success: true, key, size: buffer.length });
    }

    return NextResponse.json({ error: 'Unsupported content type or missing key' }, { status: 400 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  // PUT works the same as POST for raw binary uploads
  const key = req.nextUrl.searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
  }

  try {
    const { user } = await validateUserAndToken(req.headers.get('authorization'));
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || undefined;
    const buffer = Buffer.from(await req.arrayBuffer());
    await localStorage.putObject(key, buffer, contentType);

    return NextResponse.json({ success: true, key, size: buffer.length });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
