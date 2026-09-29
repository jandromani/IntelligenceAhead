import { NextResponse } from 'next/server';
import { getJDownloader, stopJDownloaderContainer } from '@/lib/jdownloader';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const jd = await getJDownloader();
    return NextResponse.json({
      ok: true,
      sandbox: jd.sandbox.name,
      url: jd.url,
      username: jd.username,
      password: jd.password,
      status: jd.containerStatus,
      engine: 'jlesage/jdownloader-2',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    return NextResponse.json(await stopJDownloaderContainer());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
