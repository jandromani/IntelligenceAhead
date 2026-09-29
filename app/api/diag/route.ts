import { NextResponse } from 'next/server';
import { getAriaSandbox, rpc } from '@/lib/aria2';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sbx = await getAriaSandbox();
    const [logCmd, netCmd, dnsCmd, version, global] = await Promise.all([
      sbx.runCommand({ cmd: 'bash', args: ['-lc', 'tail -n 160 /vercel/sandbox/aria2.log 2>/dev/null || true'] }),
      sbx.runCommand({ cmd: 'bash', args: ['-lc', 'ss -tuna 2>/dev/null | head -n 120 || netstat -an 2>/dev/null | head -n 120 || true'] }),
      sbx.runCommand({ cmd: 'bash', args: ['-lc', "getent hosts tracker.opentrackr.org || true; curl -I -L --max-time 10 https://tracker.opentrackr.org:443/announce 2>&1 | head -n 30 || true"] }),
      rpc(sbx, 'aria2.getVersion', []),
      rpc(sbx, 'aria2.getGlobalStat', []),
    ]);
    return NextResponse.json({
      sandbox: sbx.name,
      version,
      global,
      log: await logCmd.stdout(),
      net: await netCmd.stdout(),
      connectivity: await dnsCmd.stdout(),
    }, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
