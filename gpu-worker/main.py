import hashlib
import hmac
import json
import os
import secrets
import shutil
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from pipeline import run_reconstruction

ROOT = Path(os.environ.get("REALITY_WORKER_ROOT", "/data/reality-jobs")).resolve()
ROOT.mkdir(parents=True, exist_ok=True)
SHARED_SECRET = os.environ.get("REALITY_PRO_SHARED_SECRET", "")
MAX_UPLOAD_GB = float(os.environ.get("REALITY_MAX_UPLOAD_GB", "4"))
TOKEN_TTL = int(os.environ.get("REALITY_BOOTSTRAP_TTL", "600"))
ALLOWED_ORIGINS = [x.strip() for x in os.environ.get("REALITY_ALLOWED_ORIGINS", "*").split(",") if x.strip()]

app = FastAPI(title="Reality Compiler GPU Worker", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

executor = ThreadPoolExecutor(max_workers=max(1, int(os.environ.get("REALITY_GPU_CONCURRENCY", "1"))))
jobs = {}
jobs_lock = threading.Lock()


def now():
    return time.time()


def job_dir(job_id: str) -> Path:
    return ROOT / job_id


def state_path(job_id: str) -> Path:
    return job_dir(job_id) / "state.json"


def persist(job_id: str):
    with jobs_lock:
        data = dict(jobs[job_id])
    p = state_path(job_id)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, default=str))
    tmp.replace(p)


def update_job(job_id: str, **changes):
    with jobs_lock:
        if job_id not in jobs:
            return
        jobs[job_id].update(changes)
        jobs[job_id]["updated_at"] = now()
    persist(job_id)


def verify_bootstrap(authorization: str | None):
    if not SHARED_SECRET:
        return
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing worker bootstrap token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        ts_s, nonce, signature = token.split(".", 2)
        ts = int(ts_s)
    except Exception:
        raise HTTPException(401, "Malformed worker bootstrap token")
    if abs(int(now()) - ts) > TOKEN_TTL:
        raise HTTPException(401, "Expired worker bootstrap token")
    expected = hmac.new(
        SHARED_SECRET.encode(),
        f"{ts}.{nonce}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(401, "Invalid worker bootstrap token")


def assert_job_access(job_id: str, access_token: str):
    with jobs_lock:
        job = jobs.get(job_id)
    if not job:
        p = state_path(job_id)
        if p.exists():
            job = json.loads(p.read_text())
            with jobs_lock:
                jobs[job_id] = job
    if not job:
        raise HTTPException(404, "Unknown job")
    if not access_token or not secrets.compare_digest(access_token, job["access_token"]):
        raise HTTPException(403, "Invalid job access token")
    return job


def worker_entry(job_id: str, input_path: str, input_kind: str, mode: str, frames_target: int):
    try:
        update_job(job_id, status="running", stage="preflight", progress=2, started_at=now())
        result = run_reconstruction(
            job_id=job_id,
            input_path=Path(input_path),
            workdir=job_dir(job_id),
            input_kind=input_kind,
            mode=mode,
            frames_target=frames_target,
            update=lambda **kw: update_job(job_id, **kw),
        )
        update_job(
            job_id,
            status="done",
            stage="done",
            progress=100,
            result_path=str(result["ply_path"]),
            splats=result.get("splats"),
            metrics=result.get("metrics"),
            finished_at=now(),
        )
    except Exception as exc:
        update_job(
            job_id,
            status="error",
            stage="error",
            error=f"{type(exc).__name__}: {exc}",
            progress=100,
            finished_at=now(),
        )


@app.get("/health")
def health():
    gpu = False
    gpu_name = None
    try:
        import torch
        gpu = bool(torch.cuda.is_available())
        gpu_name = torch.cuda.get_device_name(0) if gpu else None
    except Exception:
        pass
    return {
        "ok": True,
        "service": "reality-compiler-gpu-worker",
        "gpu": gpu,
        "gpu_name": gpu_name,
        "pipeline": "nerfstudio-splatfacto-gsplat",
        "commercial_path": True,
        "root": str(ROOT),
    }


@app.post("/jobs")
async def create_job(
    file: UploadFile | None = File(default=None),
    files: list[UploadFile] = File(default=[]),
    mode: str = Form("pro"),
    frames_target: int = Form(0),
    authorization: str | None = Header(default=None),
):
    verify_bootstrap(authorization)
    mode = mode.lower().strip()
    if mode not in {"pro", "ultra"}:
        raise HTTPException(400, "mode must be pro or ultra")

    if frames_target <= 0:
        frames_target = 140 if mode == "pro" else 240
    frames_target = max(40, min(frames_target, 320))

    job_id = uuid.uuid4().hex
    access_token = secrets.token_urlsafe(32)
    d = job_dir(job_id)
    d.mkdir(parents=True, exist_ok=False)
    if file is None and not files:
        shutil.rmtree(d, ignore_errors=True)
        raise HTTPException(400, "Upload one video or one/more images")

    max_bytes = int(MAX_UPLOAD_GB * 1024**3)
    written = 0
    input_kind = "video" if file is not None else "images"

    async def save_upload(src: UploadFile, dst: Path):
        nonlocal written
        with dst.open("wb") as out:
            while True:
                chunk = await src.read(1024 * 1024 * 4)
                if not chunk:
                    break
                written += len(chunk)
                if written > max_bytes:
                    raise HTTPException(413, f"Upload exceeds {MAX_UPLOAD_GB:g} GB worker limit")
                out.write(chunk)
        await src.close()

    try:
        if file is not None:
            suffix = Path(file.filename or "capture.mp4").suffix.lower() or ".mp4"
            input_path = d / f"capture{suffix}"
            await save_upload(file, input_path)
        else:
            input_path = d / "images"
            input_path.mkdir()
            for i, src in enumerate(files):
                suffix = Path(src.filename or f"image-{i:04d}.jpg").suffix.lower() or ".jpg"
                await save_upload(src, input_path / f"image-{i:04d}{suffix}")
    except Exception:
        shutil.rmtree(d, ignore_errors=True)
        raise

    job = {
        "job_id": job_id,
        "access_token": access_token,
        "status": "queued",
        "stage": "queued",
        "progress": 0,
        "mode": mode,
        "frames_target": frames_target,
        "filename": file.filename if file is not None else f"{len(files)} images",
        "input_kind": input_kind,
        "bytes": written,
        "created_at": now(),
        "updated_at": now(),
        "log_tail": [],
        "error": None,
        "result_path": None,
    }
    with jobs_lock:
        jobs[job_id] = job
    persist(job_id)
    executor.submit(worker_entry, job_id, str(input_path), input_kind, mode, frames_target)

    return {
        "job_id": job_id,
        "access_token": access_token,
        "status": "queued",
        "mode": mode,
        "frames_target": frames_target,
    }


@app.get("/jobs/{job_id}")
def get_job(job_id: str, access_token: str):
    job = assert_job_access(job_id, access_token)
    safe = {k: v for k, v in job.items() if k not in {"access_token", "result_path"}}
    safe["result_ready"] = bool(job.get("result_path") and Path(job["result_path"]).exists())
    return safe


@app.get("/jobs/{job_id}/result")
def get_result(job_id: str, access_token: str):
    job = assert_job_access(job_id, access_token)
    if job.get("status") != "done":
        raise HTTPException(409, f"Job is {job.get('status')}")
    p = Path(job.get("result_path") or "")
    if not p.exists():
        raise HTTPException(404, "Result file is missing")
    return FileResponse(
        p,
        media_type="application/octet-stream",
        filename=f"reality-{job_id}.ply",
        headers={"Cache-Control": "private, max-age=3600"},
    )
