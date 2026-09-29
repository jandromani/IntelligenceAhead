import { Sandbox } from '@vercel/sandbox';

const SANDBOX_NAME = 'aria2-batch-lab';
const RPC = 'http://127.0.0.1:6800/jsonrpc';

async function setup(sbx: Sandbox) {
  const install = await sbx.runCommand({
    cmd: 'bash',
    args: ['-lc', `
      set -e
      if ! command -v aria2c >/dev/null 2>&1; then
        if command -v apt-get >/dev/null 2>&1; then
          apt-get update -y
          DEBIAN_FRONTEND=noninteractive apt-get install -y aria2 curl ca-certificates
        elif command -v dnf >/dev/null 2>&1; then
          dnf install -y aria2 curl ca-certificates
        else
          echo "No supported package manager found" >&2
          exit 1
        fi
      fi
      mkdir -p /vercel/sandbox/downloads /vercel/sandbox/aria2-session
      touch /vercel/sandbox/aria2-session/session.txt
    `],
    sudo: true,
  });
  if (install.exitCode !== 0) throw new Error(await install.stderr());
}

async function ensureDaemon(sbx: Sandbox) {
  const cmd = await sbx.runCommand({
    cmd: 'bash',
    args: ['-lc', `
      set -e
      mkdir -p /vercel/sandbox/downloads /vercel/sandbox/aria2-session
      touch /vercel/sandbox/aria2-session/session.txt
      if ! pgrep -x aria2c >/dev/null 2>&1; then
        nohup aria2c \\
          --enable-rpc=true \\
          --rpc-listen-all=false \\
          --rpc-listen-port=6800 \\
          --dir=/vercel/sandbox/downloads \\
          --input-file=/vercel/sandbox/aria2-session/session.txt \\
          --save-session=/vercel/sandbox/aria2-session/session.txt \\
          --save-session-interval=30 \\
          --continue=true \\
          --max-concurrent-downloads=4 \\
          --file-allocation=none \\
          --enable-dht=true \\
          --enable-dht6=true \\
          --enable-peer-exchange=true \\
          --bt-enable-lpd=false \\
          --bt-save-metadata=true \\
          --seed-time=0 \\
          --seed-ratio=0.0 \\
          --summary-interval=0 \\
          --console-log-level=warn \\
          >/vercel/sandbox/aria2.log 2>&1 &
      fi
      for i in $(seq 1 20); do
        if curl -fsS -H 'Content-Type: application/json' \
          -d '{"jsonrpc":"2.0","id":"health","method":"aria2.getVersion","params":[]}' \
          http://127.0.0.1:6800/jsonrpc >/dev/null 2>&1; then
          exit 0
        fi
        sleep 0.25
      done
      echo "aria2 RPC did not start" >&2
      cat /vercel/sandbox/aria2.log >&2 || true
      exit 1
    `],
  });
  if (cmd.exitCode !== 0) throw new Error(await cmd.stderr());
}

export async function getAriaSandbox() {
  const sbx = await Sandbox.getOrCreate({
    name: SANDBOX_NAME,
    timeout: 40 * 60 * 1000,
    onCreate: async (sandbox) => {
      await setup(sandbox);
      await ensureDaemon(sandbox);
    },
    onResume: async (sandbox) => {
      await ensureDaemon(sandbox);
    },
  });
  await ensureDaemon(sbx);
  return sbx;
}

export async function rpc(sbx: Sandbox, method: string, params: unknown[] = []) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 'q', method, params });
  const cmd = await sbx.runCommand('curl', [
    '-fsS', '-H', 'Content-Type: application/json', '-d', body, RPC,
  ]);
  const stdout = await cmd.stdout();
  if (cmd.exitCode !== 0) throw new Error((await cmd.stderr()) || `RPC ${method} failed`);
  const parsed = JSON.parse(stdout || '{}');
  if (parsed.error) throw new Error(parsed.error.message || JSON.stringify(parsed.error));
  return parsed.result;
}

const FIELDS = [
  'gid','status','totalLength','completedLength','downloadSpeed','uploadSpeed',
  'numSeeders','connections','files','bittorrent','errorMessage','followedBy'
];

export async function getJobs() {
  const sbx = await getAriaSandbox();
  const [active, waiting, stopped] = await Promise.all([
    rpc(sbx, 'aria2.tellActive', [FIELDS]),
    rpc(sbx, 'aria2.tellWaiting', [0, 100, FIELDS]),
    rpc(sbx, 'aria2.tellStopped', [0, 100, FIELDS]),
  ]);
  return { sandbox: sbx.name, active, waiting, stopped };
}

export async function addUris(uris: string[], metadataOnly = false) {
  const sbx = await getAriaSandbox();
  const gids: string[] = [];
  for (const uri of uris) {
    const options: Record<string, string> = {
      dir: '/vercel/sandbox/downloads',
      'seed-time': '0',
      'seed-ratio': '0.0',
    };
    if (metadataOnly && uri.startsWith('magnet:')) {
      options['bt-metadata-only'] = 'true';
      options['bt-save-metadata'] = 'true';
    }
    const gid = await rpc(sbx, 'aria2.addUri', [[uri], options]);
    gids.push(gid);
  }
  return gids;
}

export async function listFiles() {
  const sbx = await getAriaSandbox();
  const cmd = await sbx.runCommand({
    cmd: 'bash',
    args: ['-lc', `find /vercel/sandbox/downloads -type f -printf '%P\\t%s\\n' 2>/dev/null | sort`],
  });
  const out = await cmd.stdout();
  return out.trim().split('\n').filter(Boolean).map((line) => {
    const [path, size] = line.split('\t');
    return { path, size: Number(size || 0) };
  });
}