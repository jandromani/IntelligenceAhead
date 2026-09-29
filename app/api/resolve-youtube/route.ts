import { NextRequest, NextResponse } from 'next/server';
import { getAriaSandbox } from '@/lib/aria2';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

async function ensureYtDlp(sbx: any) {
  const cmd = await sbx.runCommand({
    cmd: 'bash',
    args: ['-lc', `
      set -e
      if ! command -v yt-dlp >/dev/null 2>&1; then
        curl -L --fail --silent --show-error \
          https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
          -o /vercel/sandbox/yt-dlp
        chmod +x /vercel/sandbox/yt-dlp
        ln -sf /vercel/sandbox/yt-dlp /usr/local/bin/yt-dlp 2>/dev/null || true
      fi
      yt-dlp --version
    `],
    sudo: true,
  });
  if (cmd.exitCode !== 0) throw new Error(await cmd.stderr());
}

function safeLine(s: string) {
  return s.replace(/[\r\n]+/g, ' ').trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const queries = Array.isArray(body?.queries)
      ? body.queries.map((q: unknown) => safeLine(String(q))).filter(Boolean)
      : [];
    if (!queries.length) return NextResponse.json({ error: 'No queries supplied' }, { status: 400 });
    if (queries.length > 25) return NextResponse.json({ error: 'Maximum 25 queries per batch' }, { status: 400 });

    const sbx = await getAriaSandbox();
    await ensureYtDlp(sbx);

    const results = [];
    for (const query of queries) {
      const cmd = await sbx.runCommand({
        cmd: 'yt-dlp',
        args: [
          '--flat-playlist',
          '--no-warnings',
          '--playlist-end', '1',
          '--print', '%(webpage_url)s\t%(title)s\t%(channel)s',
          'ytsearch1:' + query,
        ],
      });
      const stdout = (await cmd.stdout()).trim();
      const stderr = (await cmd.stderr()).trim();
      if (cmd.exitCode !== 0 || !stdout) {
        results.push({ query, ok: false, error: stderr || 'No result' });
        continue;
      }
      const [url, title, channel] = stdout.split('\t');
      results.push({ query, ok: true, url, title, channel });
    }

    return NextResponse.json({ ok: true, count: results.length, results }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
