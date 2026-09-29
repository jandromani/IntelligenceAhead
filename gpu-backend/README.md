# Reality Compiler GPU node

Commercial-quality reconstruction node for Reality Compiler.

## What is actually wired

- Upload **video or multi-view photos** over multipart HTTP.
- Video frame extraction with ffmpeg.
- Persistent **Depth Anything 3** model on CUDA.
- Direct DA3 Python call with `infer_gs=True`.
- Exports `mini_npz + GLB + depth visualizations + Gaussian PLY`.
- Single-GPU queue.
- Job status API and artifact downloads.
- Five-minute HMAC browser tokens; the long-lived shared secret never needs to be exposed to the browser.
- DA3 pinned to a known commit for reproducibility.

## GPU

Start with a 24 GB NVIDIA GPU for experiments. The nested Giant/Large model and Gaussian branch are intentionally the quality path; lower-memory cards may require a smaller DA3 checkpoint or lower `process_res`.

```bash
cp .env.example .env
# generate a secret, use the SAME value on Vercel
openssl rand -hex 32
docker compose up --build
curl http://localhost:8008/health
```

For RunPod/Lambda/another GPU VM, build this image, expose port 8008 behind HTTPS, persist `/root/.cache/huggingface` and `/workspace`, and set `REALITY_PRO_SHARED_SECRET`.

## Contract

`POST /v1/jobs` multipart:
- `video`: one video, OR
- `images`: 2..72 images
- `mode=pro`
- `process_res=1008`

Poll `GET /v1/jobs/{id}`, then download `artifacts.splat`.

This gateway exists because the stock DA3 backend accepts server-side `image_paths` and its current REST request model does not expose the `infer_gs` switch required for `gs_ply`. Reality Compiler calls the official Python API directly instead.
