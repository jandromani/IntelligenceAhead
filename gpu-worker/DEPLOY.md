# Deploying the Reality Compiler GPU worker

The web app expects two Vercel environment variables:

- `REALITY_PRO_BACKEND_URL=https://<gpu-worker-host>`
- `REALITY_PRO_SHARED_SECRET=<same-random-secret-used-by-worker>`

The worker image is built by GitHub Actions as:

`ghcr.io/jandromani/reality-compiler-gpu:preview`

## Generic NVIDIA host

```bash
export REALITY_PRO_SHARED_SECRET="$(openssl rand -hex 32)"
docker run -d --name reality-gpu \
  --gpus all \
  --restart unless-stopped \
  --shm-size=12g \
  -p 8000:8000 \
  -e REALITY_PRO_SHARED_SECRET="$REALITY_PRO_SHARED_SECRET" \
  -e REALITY_ALLOWED_ORIGINS="https://intelligence-ahead-git-reality-comp-c70dff-jandromanis-projects.vercel.app" \
  -v reality-jobs:/data \
  -v reality-cache:/root/.cache \
  ghcr.io/jandromani/reality-compiler-gpu:preview
```

Put TLS/reverse-proxy in front of port 8000, then set the HTTPS URL in Vercel.

## Minimum smoke test

```bash
curl https://<gpu-worker-host>/health
```

Do not connect it to Vercel unless `gpu:true`.

## First reconstruction test

Use a 15–30 second room video with slow translational movement and overlap.
PRO targets 140 source frames; ULTRA targets 240 and Splatfacto Big.

The browser creates the job directly on the worker, then polls progress and
loads the resulting Gaussian PLY into SuperSplat.
