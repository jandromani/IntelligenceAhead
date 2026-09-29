import asyncio, hashlib, hmac, json, os, re, secrets, shutil, subprocess, time, uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

WORKSPACE=Path(os.getenv("REALITY_WORKSPACE","/workspace/jobs")).resolve()
MODEL_ID=os.getenv("DA3_MODEL_ID","depth-anything/DA3NESTED-GIANT-LARGE")
DEVICE=os.getenv("DA3_DEVICE","cuda")
SHARED_SECRET=os.getenv("REALITY_PRO_SHARED_SECRET","")
MAX_FRAMES=int(os.getenv("REALITY_MAX_FRAMES","72"))
WORKSPACE.mkdir(parents=True,exist_ok=True)

app=FastAPI(title="Reality Compiler GPU",version="4.0.0")
origins=[x.strip() for x in os.getenv("REALITY_CORS_ORIGINS","*").split(",") if x.strip()]
app.add_middleware(CORSMiddleware,allow_origins=origins or ["*"],allow_credentials=False,allow_methods=["*"],allow_headers=["*"])

jobs={}
executor=ThreadPoolExecutor(max_workers=1)
model=None
model_lock=asyncio.Lock()

def verify_token(auth: Optional[str]):
    if not SHARED_SECRET:
        return
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(401,"Missing bearer token")
    token=auth[7:]
    try:
        ts_s,nonce,sig=token.split(".",2)
        ts=int(ts_s)
    except Exception:
        raise HTTPException(401,"Malformed token")
    if abs(int(time.time())-ts)>300:
        raise HTTPException(401,"Expired token")
    expected=hmac.new(SHARED_SECRET.encode(),f"{ts}.{nonce}".encode(),hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig,expected):
        raise HTTPException(401,"Invalid token")

def safe_name(name:str)->str:
    name=Path(name or "upload.bin").name
    return re.sub(r"[^A-Za-z0-9._-]+","_",name)[:120]

def get_model():
    global model
    if model is None:
        from depth_anything_3.api import DepthAnything3
        import torch
        model=DepthAnything3.from_pretrained(MODEL_ID).to(torch.device(DEVICE))
        model.eval()
    return model

def extract_video(video:Path,out:Path,max_frames:int):
    out.mkdir(parents=True,exist_ok=True)
    # Dense enough for indoor parallax; cap count deterministically.
    probe=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=nw=1:nk=1",str(video)],capture_output=True,text=True,check=True)
    duration=max(.1,float(probe.stdout.strip() or 1))
    fps=min(3.0,max(.6,max_frames/duration))
    subprocess.run(["ffmpeg","-y","-i",str(video),"-vf",f"fps={fps:.4f},scale='min(1920,iw)':-2","-q:v","2",str(out/"frame_%05d.jpg")],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    frames=sorted(out.glob("*.jpg"))
    if len(frames)>max_frames:
        keep=[]
        for i in range(max_frames):
            keep.append(frames[round(i*(len(frames)-1)/(max_frames-1))])
        ks={p.name for p in keep}
        for p in frames:
            if p.name not in ks:p.unlink(missing_ok=True)
    return sorted(out.glob("*.jpg"))

def run_job(job_id:str,mode:str,process_res:int):
    job=jobs[job_id]; job["status"]="running";job["started_at"]=time.time()
    root=Path(job["root"]); images=sorted((root/"images").glob("*"))
    try:
        if len(images)<2: raise RuntimeError("Need at least 2 overlapping views")
        job["message"]=f"Loading {MODEL_ID}"; job["progress"]=.05
        m=get_model()
        export=root/"output"; export.mkdir(exist_ok=True)
        formats="mini_npz-glb-depth_vis-gs_ply"
        job["message"]=f"DA3 multiview + Gaussian head on {len(images)} views";job["progress"]=.18
        # infer_gs is deliberately direct Python API: official REST backend currently
        # does not expose this switch.
        m.inference(
            [str(p) for p in images],
            export_dir=str(export),
            export_format=formats,
            process_res=process_res,
            process_res_method="upper_bound_resize",
            infer_gs=True,
            ref_view_strategy="saddle_balanced",
            conf_thresh_percentile=30.0 if mode=="pro" else 40.0,
            num_max_points=2_000_000 if mode=="pro" else 1_000_000,
            show_cameras=False,
        )
        job["progress"]=.92; job["message"]="Indexing artifacts"
        artifacts={}
        for p in export.rglob("*"):
            if p.is_file() and p.suffix.lower() in {".ply",".glb",".npz",".mp4",".jpg",".png"}:
                key=("splat" if p.suffix.lower()==".ply" and "gs_ply" in str(p) else
                     "scene" if p.name=="scene.glb" else
                     "preview" if p.name=="scene.jpg" else p.name)
                artifacts[key]=str(p)
        if "splat" not in artifacts:
            # Fallback: first PLY anywhere in output.
            ps=list(export.rglob("*.ply"))
            if ps: artifacts["splat"]=str(ps[0])
        job["artifacts"]=artifacts
        job["status"]="completed";job["progress"]=1.0;job["message"]="Gaussian world ready";job["completed_at"]=time.time()
    except Exception as e:
        job["status"]="failed";job["message"]=str(e);job["error"]=repr(e);job["completed_at"]=time.time()
        try:
            import torch
            if torch.cuda.is_available(): torch.cuda.empty_cache()
        except Exception: pass

@app.get("/health")
def health():
    gpu={}
    try:
        import torch
        gpu={"cuda":torch.cuda.is_available(),"name":torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
             "memory_gb":round(torch.cuda.get_device_properties(0).total_memory/2**30,1) if torch.cuda.is_available() else None}
    except Exception as e: gpu={"cuda":False,"error":str(e)}
    return {"ok":True,"model_id":MODEL_ID,"model_loaded":model is not None,"gpu":gpu,"queue":{"jobs":len(jobs)}}

@app.post("/v1/jobs")
async def create_job(
    authorization: Optional[str]=Header(default=None),
    mode:str=Form("pro"),
    process_res:int=Form(1008),
    video:Optional[UploadFile]=File(default=None),
    images:List[UploadFile]=File(default=[]),
):
    verify_token(authorization)
    if not video and len(images)<2: raise HTTPException(400,"Upload a video or at least 2 overlapping images")
    process_res=max(504,min(1344,int(process_res)))
    job_id=uuid.uuid4().hex
    root=WORKSPACE/job_id; imgdir=root/"images"; imgdir.mkdir(parents=True)
    if video:
        vp=root/safe_name(video.filename or "scan.mp4")
        with vp.open("wb") as f:
            while chunk:=await video.read(8*1024*1024): f.write(chunk)
        try: extract_video(vp,imgdir,MAX_FRAMES)
        except Exception as e: raise HTTPException(400,f"Video extraction failed: {e}")
    else:
        for i,u in enumerate(images[:MAX_FRAMES]):
            ext=Path(u.filename or ".jpg").suffix.lower()
            if ext not in {".jpg",".jpeg",".png",".webp",".bmp",".tif",".tiff"}: ext=".jpg"
            p=imgdir/f"{i:05d}{ext}"
            with p.open("wb") as f:
                while chunk:=await u.read(8*1024*1024): f.write(chunk)
    count=len(list(imgdir.glob("*")))
    jobs[job_id]={"id":job_id,"root":str(root),"status":"pending","message":"Queued","progress":0.0,"frames":count,"mode":mode,"created_at":time.time(),"artifacts":{}}
    executor.submit(run_job,job_id,mode,process_res)
    return {"ok":True,"job_id":job_id,"frames":count,"status_url":f"/v1/jobs/{job_id}"}

@app.get("/v1/jobs/{job_id}")
def job_status(job_id:str,authorization:Optional[str]=Header(default=None)):
    verify_token(authorization)
    j=jobs.get(job_id)
    if not j: raise HTTPException(404,"Unknown job")
    return {k:v for k,v in j.items() if k not in {"root","artifacts"}} | {
        "artifacts":{k:f"/v1/jobs/{job_id}/artifacts/{k}" for k in j.get("artifacts",{})}
    }

@app.get("/v1/jobs/{job_id}/artifacts/{kind}")
def artifact(job_id:str,kind:str,authorization:Optional[str]=Header(default=None)):
    verify_token(authorization)
    j=jobs.get(job_id)
    if not j or kind not in j.get("artifacts",{}): raise HTTPException(404,"Artifact not ready")
    p=Path(j["artifacts"][kind]).resolve()
    if not p.is_file() or not str(p).startswith(str(Path(j["root"]).resolve())): raise HTTPException(404,"Artifact unavailable")
    return FileResponse(p,filename=p.name,media_type="application/octet-stream")
