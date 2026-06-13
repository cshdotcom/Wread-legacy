/**
 * WRead Storage Download API Route
 * Rewritten to use local file storage instead of S3 presigned URLs.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { NextRequest, NextResponse } from 'next/server';
import { validateUserAndToken } from '@/utils/wread-auth';
import { getFileByKey } from '@/utils/wread-db';
import { localStorage } from '@/utils/wread-storage';
import { runMiddleware, corsAllMethods } from '@/utils/cors';

export async function POST(req: NextRequest) {
  const { user } = await validateUserAndToken(req.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { file_keys } = body as { file_keys: string[] };

    if (!file_keys || !Array.isArray(file_keys)) {
      return NextResponse.json({ error: 'file_keys array is required' }, { status: 400 });
    }

    // Return download URLs for each file key
    const urls = file_keys.map((key) => ({
      file_key: key,
      download_url: localStorage.getDownloadUrl(key),
    }));

    return NextResponse.json({ urls });
  } catch (error) {
    console.error('Storage download error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { user } = await validateUserAndToken(req.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const fileKey = req.nextUrl.searchParams.get('file_key');
  if (!fileKey) {
    return NextResponse.json({ error: 'file_key is required' }, { status: 400 });
  }

  return NextResponse.json({ download_url: localStorage.getDownloadUrl(fileKey) });
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (!req.url) return res.status(400).json({ error: 'Invalid request URL' });
  const protocol = process.env['PROTOCOL'] || 'http';
  const host = process.env['HOST'] || 'localhost:3000';
  const url = new URL(req.url, `${protocol}://${host}`);
  await runMiddleware(req, res, corsAllMethods);

  try {
    let response: Response;
    if (req.method === 'GET') {
      const nextReq = new NextRequest(url.toString(), {
        headers: new Headers(req.headers as Record<string, string>),
        method: 'GET',
      });
      response = await GET(nextReq);
    } else if (req.method === 'POST') {
      const nextReq = new NextRequest(url.toString(), {
        headers: new Headers(req.headers as Record<string, string>),
        method: 'POST',
        body: JSON.stringify(req.body),
      });
      response = await POST(nextReq);
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export default handler;
