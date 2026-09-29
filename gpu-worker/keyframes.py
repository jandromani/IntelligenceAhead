import json
import math
import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image


def _run(cmd):
    subprocess.run([str(x) for x in cmd], check=True)


def _frame_score(path: Path):
    with Image.open(path) as im:
        im = im.convert("L")
        im.thumbnail((384, 256), Image.Resampling.BILINEAR)
        a = np.asarray(im, dtype=np.float32)

    if min(a.shape) < 5:
        return -1e9, {}

    core = a[1:-1, 1:-1]
    lap = (
        -4.0 * core
        + a[1:-1, :-2]
        + a[1:-1, 2:]
        + a[:-2, 1:-1]
        + a[2:, 1:-1]
    )
    sharp = float(np.var(lap))
    mean = float(np.mean(a))
    contrast = float(np.std(a))
    clipped = float(np.mean((a < 7) | (a > 248)))

    # Reward detail/contrast; strongly reject clipped or extreme exposure.
    exposure_penalty = abs(mean - 128.0) / 128.0
    score = math.log1p(max(0.0, sharp)) * 18.0 + min(80.0, contrast) * 0.35
    score -= exposure_penalty * 22.0
    score -= clipped * 90.0

    hist, _ = np.histogram(a, bins=32, range=(0, 256))
    hist = hist.astype(np.float32)
    hist /= max(1.0, float(hist.sum()))
    return score, {
        "sharpness": sharp,
        "brightness": mean,
        "contrast": contrast,
        "clipped": clipped,
        "hist": hist,
    }


def select_video_keyframes(video: Path, output_dir: Path, target: int, duration: float):
    output_dir.mkdir(parents=True, exist_ok=True)
    candidates_dir = output_dir.parent / "_candidates"
    shutil.rmtree(candidates_dir, ignore_errors=True)
    candidates_dir.mkdir(parents=True, exist_ok=True)

    # Oversample, then choose one high-quality frame per temporal bin.
    # Keeps overlap/trajectory continuity while rejecting blur/exposure failures.
    desired_candidates = max(120, int(target * 2.5))
    fps = min(12.0, max(1.0, desired_candidates / max(1.0, duration)))

    _run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(video),
        "-vf", f"fps={fps:.5f}",
        "-q:v", "2",
        str(candidates_dir / "candidate_%06d.jpg"),
    ])

    candidates = sorted(candidates_dir.glob("candidate_*.jpg"))
    if len(candidates) < 12:
        raise RuntimeError(f"Only {len(candidates)} candidate frames could be extracted")

    actual_target = min(int(target), len(candidates))
    scored = []
    for p in candidates:
        score, stats = _frame_score(p)
        scored.append((p, score, stats))

    selected = []
    previous_hist = None
    for b in range(actual_target):
        lo = round(b * len(scored) / actual_target)
        hi = max(lo + 1, round((b + 1) * len(scored) / actual_target))
        group = scored[lo:hi]
        best = None
        best_score = -1e18
        for p, quality, stats in group:
            novelty = 0.0
            if previous_hist is not None:
                novelty = float(np.abs(stats["hist"] - previous_hist).sum())
            combined = quality + min(1.0, novelty) * 6.0
            if combined > best_score:
                best = (p, quality, stats)
                best_score = combined
        selected.append(best)
        previous_hist = best[2]["hist"]

    telemetry = []
    for i, (src, quality, stats) in enumerate(selected, 1):
        dst = output_dir / f"frame_{i:06d}.jpg"
        shutil.copy2(src, dst)
        telemetry.append({
            "file": dst.name,
            "quality": round(float(quality), 3),
            "sharpness": round(float(stats["sharpness"]), 3),
            "brightness": round(float(stats["brightness"]), 3),
            "contrast": round(float(stats["contrast"]), 3),
            "clipped": round(float(stats["clipped"]), 5),
        })

    sharpness = [x["sharpness"] for x in telemetry]
    clipped = [x["clipped"] for x in telemetry]
    brightness = [x["brightness"] for x in telemetry]
    report = {
        "duration_s": duration,
        "candidate_fps": fps,
        "candidate_count": len(candidates),
        "selected_count": len(selected),
        "sharpness_median": float(np.median(sharpness)),
        "clipped_mean": float(np.mean(clipped)),
        "brightness_median": float(np.median(brightness)),
        "frames": telemetry,
    }
    (output_dir.parent / "keyframe_report.json").write_text(json.dumps(report, indent=2))
    shutil.rmtree(candidates_dir, ignore_errors=True)
    return report
