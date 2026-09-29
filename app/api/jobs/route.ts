import { NextRequest, NextResponse } from 'next/server';
import { addUris, getJobs } from '@/lib/aria2';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function validUri(value: string) {
  return value.startsWith('https://') || value.startsWith('http://') || value.startsWith('magnet:?');
}

export async function GET() {
  try {
    return NextResponse.json(await getJobs(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const raw = Array.isArray(body?.uris) ? body.uris : [];
    const uris = raw.map((x: unknown) => String(x).trim()).filter(Boolean);
    if (!uris.length) return NextResponse.json({ error: 'No URLs supplied' }, { status: 400 });
    if (uris.length > 200) return NextResponse.json({ error: 'Maximum 200 URLs per batch' }, { status: 400 });
    const invalid = uris.filter((u: string) => !validUri(u));
    if (invalid.length) return NextResponse.json({ error: 'Only http(s) and magnet URIs are accepted', invalid }, { status: 400 });
    const gids = await addUris(uris, Boolean(body?.metadataOnly));
    return NextResponse.json({ ok: true, gids });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}