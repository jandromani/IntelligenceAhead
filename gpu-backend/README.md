# Reality Compiler GPU node

Private NVIDIA-GPU reconstruction service for the commercial Reality Compiler pipeline.

## Commercial pipeline

```
video / multi-view photos
        ↓
ffmpeg frame extraction
        ↓
Depth Anything 3 BASE (Apache-2.0 weights)
depth + confidence + camera intrinsics/extrinsics
        ↓
COLMAP-compatible camera + seed point dataset
        ↓
gsplat MCMC (Apache-2.0)
        ↓
PRO:   7,000 optimization steps
ULTRA: 30,000 optimization steps
        ↓
Gaussian PLY
        ↓
SuperSplat in the browser
```

The commercial node **does not use DA3 GIANT, LARGE or NESTED-GIANT-LARGE weights**. Those model weights are not part of this product path.

## API

- `GET /health`
- `POST /v1/jobs` — multipart video or 4+ images
- `GET /v1/jobs/{job_id}`
- `GET /v1/jobs/{job_id}/artifacts/splat`
- `GET /v1/jobs/{job_id}/artifacts/log`

`POST /v1/jobs` accepts:
- `video`: one video, or
- `images`: 4–72 overlapping images
- `mode=pro|ultra`
- `process_res=504..1008`

The browser receives a five-minute HMAC token from the Vercel control plane and uploads media **directly** to this node, so large scans do not cross a Vercel Function.

## Run

A 24 GB NVIDIA GPU is a sensible starting point while the memory envelope is measured.

```bash
cp .env.example .env
openssl rand -hex 32
# put that value in REALITY_PRO_SHARED_SECRET both here and in Vercel
docker compose up --build
curl http://localhost:8008/health
```

Then set on Vercel:
- `REALITY_PRO_BACKEND_URL=https://gpu.example.com`
- `REALITY_PRO_SHARED_SECRET=<same secret>`

Persist:
- `/root/.cache/huggingface`
- `/workspace`

## Current verification boundary

The web/Vercel control plane and public-Hugging-Face API path have been exercised. The CUDA image and 7k/30k optimization stages still require an actual NVIDIA node for an end-to-end execution. The server deliberately keeps the gsplat log as an artifact so GPU failures can be diagnosed instead of becoming opaque client errors.
