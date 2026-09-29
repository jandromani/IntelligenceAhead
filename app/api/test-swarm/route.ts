import { NextResponse } from 'next/server';
import { getAriaSandbox, rpc } from '@/lib/aria2';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const TORRENT_URL = 'https://releases.ubuntu.com/24.04/ubuntu-24.04.5.1-desktop-amd64.iso.torrent';
const FIELDS = [
  'gid','status','totalLength','completedLength','downloadSpeed','uploadSpeed',
  'numSeeders','connections','files','bittorrent','errorMessage','followedBy'
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET() {
  let sbx;
  let parentGid: string | undefined;
  let childGid: string | undefined;
  try {
    sbx = await getAriaSandbox();
    parentGid = await rpc(sbx, 'aria2.addUri', [[TORRENT_URL], {
      'follow-torrent': 'mem',
      'seed-time': '0',
      'seed-ratio': '0.0',
      'file-allocation': 'none',
    }]);

    let parent: any = null;
    for (let i = 0; i < 30; i++) {
      parent = await rpc(sbx, 'aria2.tellStatus', [parentGid, FIELDS]);
      childGid = parent?.followedBy?.[0];
      if (childGid) break;
      if (parent?.status === 'error' || parent?.status === 'removed') break;
      await sleep(350);
    }

    if (!childGid) {
      return NextResponse.json({
        ok: false,
        phase: 'torrent-metadata',
        parent,
        message: 'Torrent metadata downloaded but no BitTorrent child job was created in time.',
      }, { status: 502 });
    }

    await rpc(sbx, 'aria2.changeOption', [childGid, {
      'max-download-limit': '32K',
      'max-upload-limit': '1K',
      'seed-time': '0',
      'seed-ratio': '0.0',
    }]);

    let peakConnections = 0;
    let peakSeeders = 0;
    let peakDownloadSpeed = 0;
    let sample: any = null;
    const samples: any[] = [];

    for (let i = 0; i < 20; i++) {
      sample = await rpc(sbx, 'aria2.tellStatus', [childGid, FIELDS]);
      peakConnections = Math.max(peakConnections, Number(sample?.connections || 0));
      peakSeeders = Math.max(peakSeeders, Number(sample?.numSeeders || 0));
      peakDownloadSpeed = Math.max(peakDownloadSpeed, Number(sample?.downloadSpeed || 0));
      samples.push({
        status: sample?.status,
        connections: Number(sample?.connections || 0),
        seeders: Number(sample?.numSeeders || 0),
        speed: Number(sample?.downloadSpeed || 0),
        completed: Number(sample?.completedLength || 0),
      });
      if (peakConnections > 0 && peakDownloadSpeed > 0) break;
      await sleep(750);
    }

    return NextResponse.json({
      ok: true,
      source: 'Canonical Ubuntu 24.04.5.1 official BitTorrent',
      torrentUrl: TORRENT_URL,
      parentGid,
      childGid,
      peakConnections,
      peakSeeders,
      peakDownloadSpeed,
      finalStatus: sample?.status,
      sampledBytes: Number(sample?.completedLength || 0),
      samples,
    }, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  } finally {
    if (sbx && childGid) {
      try { await rpc(sbx, 'aria2.forceRemove', [childGid]); } catch {}
    }
    if (sbx && parentGid) {
      try { await rpc(sbx, 'aria2.forceRemove', [parentGid]); } catch {}
    }
  }
}
