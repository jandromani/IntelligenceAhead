import json
import os
import re
import shutil
import subprocess
import time
from pathlib import Path

from keyframes import select_video_keyframes


def _tail_push(update, line, limit=24):
    _tail_push.lines.append(line[-800:])
    _tail_push.lines = _tail_push.lines[-limit:]
    update(log_tail=list(_tail_push.lines))
_tail_push.lines = []


def run(cmd, cwd: Path, log_path: Path, update, stage: str, start_pct: float, end_pct: float, total_steps=None):
    log_path.parent.mkdir(parents=True, exist_ok=True)
    update(stage=stage, progress=start_pct)
    with log_path.open("a", encoding="utf-8") as log:
        log.write("\n$ " + " ".join(map(str, cmd)) + "\n")
        log.flush()
        proc = subprocess.Popen(
            [str(x) for x in cmd],
            cwd=str(cwd),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env={**os.environ, "PYTHONUNBUFFERED": "1"},
        )
        for raw in iter(proc.stdout.readline, ""):
            line = raw.rstrip()
            log.write(line + "\n")
            log.flush()
            _tail_push(update, line)
            pct = None
            if total_steps:
                m = re.search(r"(?:Step|step)\s*[:=]?\s*(\d+)", line)
                if m:
                    step = min(total_steps, int(m.group(1)))
                    pct = start_pct + (end_pct - start_pct) * step / total_steps
                else:
                    m = re.search(r"([0-9]+(?:\.[0-9]+)?)%\s*(?:Done)?", line)
                    if m:
                        pct = start_pct + (end_pct - start_pct) * float(m.group(1)) / 100.0
            if pct is not None:
                update(stage=stage, progress=min(end_pct, pct))
        code = proc.wait()
    if code != 0:
        raise RuntimeError(f"{stage} failed with exit code {code}. See {log_path}")
    update(stage=stage, progress=end_pct)


def ffprobe(path: Path):
    cmd = [
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate:format=duration",
        "-of", "json", str(path),
    ]
    p = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(p.stdout)


def ply_vertex_count(path: Path):
    with path.open("rb") as f:
        for _ in range(80):
            line = f.readline().decode("ascii", "ignore").strip()
            if line.startswith("element vertex "):
                try:
                    return int(line.rsplit(" ", 1)[1])
                except Exception:
                    return None
            if line == "end_header":
                break
    return None


def run_reconstruction(job_id: str, input_path: Path, workdir: Path, input_kind: str, mode: str, frames_target: int, update):
    _tail_push.lines = []
    logs = workdir / "logs"
    dataset = workdir / "dataset"
    outputs = workdir / "outputs"
    exports = workdir / "exports"
    for p in (logs, dataset, outputs, exports):
        p.mkdir(parents=True, exist_ok=True)

    update(stage="preflight", progress=3)
    if input_kind == "video":
        meta = ffprobe(input_path)
        duration = float(meta.get("format", {}).get("duration") or 0)
        stream = (meta.get("streams") or [{}])[0]
        update(
            stage="preflight",
            progress=5,
            video={
                "duration_s": duration,
                "width": stream.get("width"),
                "height": stream.get("height"),
                "frames_target": frames_target,
            },
        )
        selected_dir = workdir / "selected_frames"
        report = select_video_keyframes(
            input_path,
            selected_dir,
            target=frames_target,
            duration=duration,
        )
        update(
            stage="preflight",
            progress=9,
            keyframes={
                "selected": report["selected_count"],
                "candidates": report["candidate_count"],
                "sharpness_median": report["sharpness_median"],
                "clipped_mean": report["clipped_mean"],
                "brightness_median": report["brightness_median"],
            },
        )
        process_cmd = [
            "ns-process-data", "images",
            "--data", str(selected_dir),
            "--output-dir", str(dataset),
            "--matching-method", "sequential",
            "--sfm-tool", "colmap",
        ]
    else:
        count = len([p for p in input_path.iterdir() if p.is_file()])
        update(stage="preflight", progress=5, images={"count": count})
        process_cmd = [
            "ns-process-data", "images",
            "--data", str(input_path),
            "--output-dir", str(dataset),
            "--matching-method", "exhaustive" if count <= 80 else "sequential",
        ]

    # Mature room-scale pose bootstrap: frames/images -> COLMAP SfM.
    run(
        process_cmd,
        cwd=workdir,
        log_path=logs / "01_process_data.log",
        update=update,
        stage="camera_solve",
        start_pct=5,
        end_pct=25,
    )

    transforms = dataset / "transforms.json"
    if not transforms.exists():
        raise RuntimeError("Camera solve finished without transforms.json")

    transforms_data = json.loads(transforms.read_text())
    registered = len(transforms_data.get("frames", []))
    expected = frames_target if input_kind == "video" else len([p for p in input_path.iterdir() if p.is_file()])
    registration_ratio = registered / max(1, expected)
    update(
        stage="camera_solve",
        progress=25,
        camera_registration={
            "registered": registered,
            "expected": expected,
            "ratio": registration_ratio,
        },
    )
    if registered < 12 or registration_ratio < 0.35:
        raise RuntimeError(
            f"Camera solve registered only {registered}/{expected} views "
            f"({registration_ratio:.0%}). Capture more translation, overlap and texture."
        )

    method = "splatfacto" if mode == "pro" else "splatfacto-big"
    # Both current Nerfstudio presets train for 30k iterations; BIG lowers
    # culling and densification thresholds for more Gaussians / quality.
    train_cmd = [
        "ns-train", method,
        "--output-dir", str(outputs),
        "--experiment-name", "room",
        "--timestamp", "run",
        "--data", str(dataset),
    ]

    run(
        train_cmd,
        cwd=workdir,
        log_path=logs / "02_train.log",
        update=update,
        stage="gaussian_optimization",
        start_pct=25,
        end_pct=88,
        total_steps=30000,
    )

    configs = sorted(outputs.rglob("config.yml"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not configs:
        raise RuntimeError("Training finished without a Nerfstudio config.yml")
    config = configs[0]

    run(
        [
            "ns-export", "gaussian-splat",
            "--load-config", str(config),
            "--output-dir", str(exports),
        ],
        cwd=workdir,
        log_path=logs / "03_export.log",
        update=update,
        stage="export",
        start_pct=88,
        end_pct=97,
    )

    plys = sorted(exports.rglob("*.ply"), key=lambda p: p.stat().st_size, reverse=True)
    if not plys:
        raise RuntimeError("Gaussian export produced no .ply")
    source_ply = plys[0]
    final_ply = workdir / "result.ply"
    shutil.copy2(source_ply, final_ply)
    splats = ply_vertex_count(final_ply)

    metrics = None
    if os.environ.get("REALITY_RUN_EVAL", "0") == "1":
        metrics_path = workdir / "metrics.json"
        try:
            run(
                ["ns-eval", "--load-config", str(config), "--output-path", str(metrics_path)],
                cwd=workdir,
                log_path=logs / "04_eval.log",
                update=update,
                stage="evaluation",
                start_pct=97,
                end_pct=99,
            )
            if metrics_path.exists():
                metrics = json.loads(metrics_path.read_text())
        except Exception as exc:
            _tail_push(update, f"EVAL WARNING: {exc}")

    result_meta = {
        "job_id": job_id,
        "mode": mode,
        "ply_path": str(final_ply),
        "bytes": final_ply.stat().st_size,
        "splats": splats,
        "config": str(config),
        "metrics": metrics,
        "finished_at": time.time(),
    }
    (workdir / "result.json").write_text(json.dumps(result_meta, indent=2, default=str))
    update(stage="finalize", progress=99, splats=splats)
    return result_meta
