import { Sandbox } from '@vercel/sandbox';

const NAME = 'jdownloader-batch-lab';
const PORT = 5800;

async function installDocker(sbx: Sandbox) {
  const cmd = await sbx.runCommand({
    cmd: 'bash',
    args: ['-lc', `
      set -e
      if ! command -v docker >/dev/null 2>&1; then
        apt-get update -y
        DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io ca-certificates openssl
      fi
      mkdir -p /vercel/sandbox/jdownloader/config /vercel/sandbox/jdownloader/output
      if [ ! -s /vercel/sandbox/jdownloader/password ]; then
        umask 077
        (openssl rand -hex 16 || tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32) > /vercel/sandbox/jdownloader/password
      fi
    `],
    sudo: true,
  });
  if (cmd.exitCode !== 0) throw new Error((await cmd.stderr()) || 'Docker install failed');
}

async function ensureDocker(sbx: Sandbox) {
  let info = await sbx.runCommand({ cmd: 'bash', args: ['-lc', 'sudo docker info >/dev/null 2>&1'] });
  if (info.exitCode === 0) return;

  await sbx.runCommand({ cmd: 'dockerd', args: ['--host=unix:///var/run/docker.sock'], sudo: true, detached: true });
  const wait = await sbx.runCommand({
    cmd: 'bash',
    args: ['-lc', 'for i in $(seq 1 60); do sudo docker info >/dev/null 2>&1 && exit 0; sleep 1; done; exit 1'],
  });
  if (wait.exitCode !== 0) throw new Error('Docker daemon did not start');
}

async function ensureContainer(sbx: Sandbox) {
  await ensureDocker(sbx);

  const exists = await sbx.runCommand({
    cmd: 'bash',
    args: ['-lc', "sudo docker inspect jdownloader-2 >/dev/null 2>&1"],
  });

  if (exists.exitCode !== 0) {
    const run = await sbx.runCommand({
      cmd: 'bash',
      args: ['-lc', `
        set -e
        PASS="$(cat /vercel/sandbox/jdownloader/password)"
        sudo docker pull jlesage/jdownloader-2:latest
        sudo docker run -d \\
          --name jdownloader-2 \\
          --restart unless-stopped \\
          --shm-size=1g \\
          -p 5800:5800 \\
          -e TZ=Europe/Madrid \\
          -e KEEP_APP_RUNNING=1 \\
          -e DARK_MODE=1 \\
          -e WEB_FILE_MANAGER=1 \\
          -e WEB_FILE_MANAGER_ALLOWED_PATHS=AUTO \\
          -e WEB_AUTHENTICATION=1 \\
          -e WEB_AUTHENTICATION_ALLOW_INSECURE=1 \\
          -e WEB_AUTHENTICATION_USERNAME=lab \\
          -e WEB_AUTHENTICATION_PASSWORD="$PASS" \\
          -v /vercel/sandbox/jdownloader/config:/config:rw \\
          -v /vercel/sandbox/jdownloader/output:/output:rw \\
          jlesage/jdownloader-2:latest
      `],
    });
    if (run.exitCode !== 0) throw new Error((await run.stderr()) || 'JDownloader container failed to start');
  } else {
    await sbx.runCommand({ cmd: 'bash', args: ['-lc', 'sudo docker start jdownloader-2 >/dev/null 2>&1 || true'] });
  }

  const ready = await sbx.runCommand({
    cmd: 'bash',
    args: ['-lc', 'for i in $(seq 1 90); do curl -fsS http://127.0.0.1:5800/ >/dev/null 2>&1 && exit 0; sleep 1; done; sudo docker logs --tail 120 jdownloader-2 >&2 || true; exit 1'],
  });
  if (ready.exitCode !== 0) throw new Error((await ready.stderr()) || 'JDownloader web UI did not become ready');
}

export async function getJDownloader() {
  const sbx = await Sandbox.getOrCreate({
    name: NAME,
    ports: [PORT],
    timeout: 40 * 60 * 1000,
    onCreate: async (sandbox) => {
      await installDocker(sandbox);
      await ensureContainer(sandbox);
    },
    onResume: async (sandbox) => {
      await ensureContainer(sandbox);
    },
  });
  await ensureContainer(sbx);

  const passCmd = await sbx.runCommand('cat', ['/vercel/sandbox/jdownloader/password']);
  const password = (await passCmd.stdout()).trim();

  const statusCmd = await sbx.runCommand({
    cmd: 'bash',
    args: ['-lc', "sudo docker inspect -f '{{.State.Status}}' jdownloader-2 2>/dev/null || true"],
  });
  const containerStatus = (await statusCmd.stdout()).trim();

  return {
    sandbox: sbx,
    url: sbx.domain(PORT),
    username: 'lab',
    password,
    containerStatus,
  };
}

export async function stopJDownloaderContainer() {
  const sbx = await Sandbox.getOrCreate({
    name: NAME,
    ports: [PORT],
    timeout: 40 * 60 * 1000,
  });
  await ensureDocker(sbx);
  await sbx.runCommand({ cmd: 'bash', args: ['-lc', 'sudo docker stop jdownloader-2 >/dev/null 2>&1 || true'] });
  return { sandbox: sbx.name, stopped: true };
}
