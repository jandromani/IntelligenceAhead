# Reality Compiler — Cannibalization ledger

This is the engineering ledger for the commercial reconstruction product. It separates code that is live, code that is wired but needs infrastructure, research references, and components deliberately excluded from the commercial core.

## LIVE in the web application

| Component | Source / idea | Status | Purpose |
|---|---|---|---|
| 4-view multiview inference | DA3-BASE-derived ONNX | LIVE | Local depth + intrinsics + extrinsics preview |
| ONNX runtime | onnxruntime-web WebGPU | LIVE | Browser inference |
| Gaussian renderer | PlayCanvas SuperSplat Viewer | LIVE | Embedded PLY/SPLAT/SOG/SPZ viewing |
| Semantic pass | Florence-2 / Transformers.js | LIVE optional | Object labels after geometry |
| Direct scan import | SuperSplat formats | LIVE | LiDAR / external capture escape hatch |
| Capture QA | Reality Compiler | LIVE | Blur/diversity/coverage gating |

## WIRED — needs the private NVIDIA GPU to execute

| Component | License strategy | Status | Purpose |
|---|---|---|---|
| Depth Anything 3 BASE | Apache-2.0 model path | WIRED | Multi-view camera/depth initializer |
| DA3→COLMAP adapter | Reality Compiler code | WIRED | Converts DA3 cameras/depth into gsplat seed data |
| gsplat MCMC | Apache-2.0 | WIRED | Photometric Gaussian optimization |
| PRO profile | 7k steps | WIRED | Fast commercial render |
| ULTRA profile | 30k steps | WIRED | Final-quality render |
| GPU ingest gateway | Reality Compiler FastAPI | WIRED | Multipart video/photos, job queue, artifacts |
| Vercel HMAC control plane | Reality Compiler | LIVE control plane | Short-lived browser→GPU authorization |

The CUDA container is reproducible, but cannot be honestly marked end-to-end tested until it is built and run on an NVIDIA machine.

## NEXT commercial integrations

1. **VGGT-SLAM 2.0** — BSD-2-Clause. Candidate for long-house scans, submaps and loop closure.
2. **SplaTAM** — BSD-3-Clause. Candidate for iPhone/iPad LiDAR RGB-D metric capture.
3. **Gaussian Grouping** — Apache-2.0 repository; dependency/license audit still required before shipping. Candidate for selecting/removing objects in the splat.
4. **Modern gsplat camera models / 3DGUT** — evaluate in a separate newer CUDA image once raw lens/rolling-shutter metadata is preserved from capture.
5. **SOG/LOD conversion** — serving optimization after the Gaussian PLY quality stage is proven.

## Research-only / deliberately excluded from commercial core

- **DA3 GIANT / LARGE / NESTED-GIANT-LARGE model weights** — not used in commercial pipeline.
- **MASt3R-SLAM** — research/non-commercial licensing path.
- **PGSR** — inherits restrictive Gaussian-splatting licensing; reference only.
- **SuGaR** — non-commercial Gaussian-splatting lineage; reference only.
- Public DA3 Gaussian Hugging Face Space — lab probe only; ZeroGPU duration policy blocked the reconstruction call and therefore it is not a production dependency.

## Actual failure discovered during integration

The public DA3+Gaussian Space API was reachable and session-safe calls worked. A cached 32-frame scene was loaded successfully. Reconstruction then failed before model execution because the Space requests a 900-second ZeroGPU allocation that is not available to the caller. This is why PRO moved to a private GPU node rather than hiding the error behind a fallback.
