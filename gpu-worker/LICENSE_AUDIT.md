# Commercial dependency audit (working document)

## Included production path

| Component | Role | Upstream license | Status |
|---|---|---|---|
| Nerfstudio | orchestration / Splatfacto | Apache-2.0 | acceptable |
| gsplat | Gaussian rasterization / optimization | Apache-2.0 | acceptable |
| COLMAP (current upstream) | SfM / camera solve | New BSD | acceptable; audit bundled deps |
| SuperSplat Viewer (web app) | Gaussian viewer | MIT | acceptable |

## Explicitly excluded from the commercial worker

- DA3NESTED-GIANT-LARGE Gaussian checkpoint: CC BY-NC 4.0.
- The public DA3-GaussianSplat Space as production infrastructure.
- Original GraphDeco Gaussian Splatting implementation where its non-commercial
  license would contaminate the product path.

## To verify before launch

- Exact licenses of every binary bundled by the chosen Nerfstudio container.
- FFmpeg build configuration/license.
- CUDA / NVIDIA container redistribution terms.
- Any future VGGT checkpoint license and accepted terms.
- Any semantic model (SAM, Florence, etc.) separately.
