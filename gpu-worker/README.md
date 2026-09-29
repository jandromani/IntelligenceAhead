# Reality Compiler GPU Worker

Commercial reconstruction worker for **room-scale Gaussian Splatting**.

## Pipeline

```
video
  -> Nerfstudio ns-process-data
  -> sequential COLMAP camera solve / sparse seed
  -> Splatfacto (PRO) or Splatfacto Big (ULTRA)
  -> gsplat iterative optimization + densification (30k iterations)
  -> ns-export gaussian-splat
  -> result.ply
  -> Reality Compiler / SuperSplat
```

This deliberately does **not** use the non-commercial DA3 Gaussian checkpoint.
The first production path is built from components with commercially usable
upstream licenses: Nerfstudio (Apache-2.0), gsplat (Apache-2.0), and current
COLMAP (new BSD). Audit binary dependencies in the final image before release.

## GPU target

- PRO: NVIDIA GPU with ~8 GB+ VRAM.
- ULTRA: 16 GB+ strongly preferred; `splatfacto-big` is documented around 12 GB.
- NVIDIA Container Toolkit required.
- Persistent volume strongly recommended for model cache and job results.

## Run

```bash
cd gpu-worker
export REALITY_PRO_SHARED_SECRET='replace-me'
export REALITY_ALLOWED_ORIGINS='https://YOUR-VERCEL-PREVIEW.vercel.app'
docker compose -f docker-compose.gpu.yml up --build
```

Health:

```bash
curl http://localhost:8000/health
```

Expected:

```json
{
  "ok": true,
  "gpu": true,
  "pipeline": "nerfstudio-splatfacto-gsplat",
  "commercial_path": true
}
```

## API

The browser gets a short-lived HMAC bootstrap token from Vercel
(`/api/reality-pro-config`). Job creation verifies that token. The worker then
returns a random per-job access token so long training jobs are not tied to the
5–10 minute bootstrap TTL.

### POST /jobs

multipart:

- `file`: MP4/MOV capture
- `mode`: `pro` or `ultra`
- `frames_target`: optional; default 140 / 240

Header:

`Authorization: Bearer <timestamp>.<nonce>.<hmac>`

### GET /jobs/{id}?access_token=...

Returns live stage, progress, log tail, video metadata, splat count and errors.

### GET /jobs/{id}/result?access_token=...

Returns the final Gaussian `.ply` for SuperSplat.

## Why this worker exists

The public Hugging Face lab proved the transport and DA3 flow, but it is not a
production backend:

1. its video input needs Gradio `VideoData`, not a bare FileData;
2. the fork requests a 900-second ZeroGPU allocation;
3. the strong DA3 Gaussian checkpoint used by that demo is non-commercial;
4. property videos should not be routed through an unrelated public Space.

This worker removes those four blockers.

## Next upgrades

The API contract is intentionally stable so the pose/bootstrap stage can later
be swapped or augmented without changing the web app:

- DA3-BASE (Apache-2.0) pose/depth priors;
- VGGT-1B-Commercial after license acceptance;
- GLOMAP/HLOC alternate SfM;
- ARKit/ARCore / LiDAR pose+depth ingestion;
- 3DGUT / rolling-shutter camera model;
- submaps + loop closure for full apartments;
- plane/manhattan cleanup;
- semantic Gaussian grouping;
- SOG conversion + LOD streaming.
