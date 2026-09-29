import asyncio, hashlib, hmac, os, re, subprocess, time, uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from commercial_pipeline import run_commercial_pipeline

WORKSPACE=Path(os.getenv("REALITY_WORKSPACE","/workspace/jobs")).resolve()
MODEL_ID=os.getenv("DA3_MODEL_ID","depth-anything/DA3-BASE")
DEVICE=os.getenv("DA3_DEVICE","cuda")
SHARED_SECRET=os.getenv("REALITY_PRO_SHARED_SECRET","")
MAX_FRAMES=int(os.getenv("REALITY_MAX_FRAMES","72"))
WORKSPACE.mkdir(parents=True,exist_ok=True)

app=FastAPI(title="Reality Compiler GPU",version="4.1.0")
origins=[x.strip() for x in os.getenv("REALITY_CORS_ORIGINS","*").split(",") if x.strip()]
app.add_middleware(CORSMiddleware,allow_origins=origins or ["*"],allow_credentials=False,allow_methods=["*"],allow_headers=["*"])
jobs={};executor=ThreadPoolExecutor(max_workers=1);model=None

def verify_token(auth: Optional[str]):
    if not SHARED_SECRET:return
    if not auth or not auth.startswith("Bearer "):raise HTTPException(401,"Missing bearer token")
    token=auth[7:]
    try:ts_s,nonce,sig=token.split(".",2);ts=int(ts_s)
    except Exception:raise HTTPException(401,"Malformed token")
    if abs(int(time.time())-ts)>300:raise HTTPException(401,"Expired token")
    expected=hmac.new(SHARED_SECRET.encode(),f"{ts}.{nonce}".encode(),hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig,expected):raise HTTPException(401,"Invalid token")

def safe_name(name:str)->str:return re.sub(r"[^A-Za-z0-9._-]+","_",Path(name or "upload.bin").name)[:120]

def get_model():
    global model
    if model is None:
        from depth_anything_3.api import DepthAnything3
        import torch
        model=DepthAnything3.from_pretrained(MODEL_ID).to(torch.device(DEVICE));model.eval()
    return model

def extract_video(video:Path,out:Path,max_frames:int):
    out.mkdir(parents=True,exist_ok=True)
    p=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=nw=1:nk=1",str(video)],capture_output=True,text=True,check=True)
    duration=max(.1,float(p.stdout.strip() or 1));fps=min(3.0,max(.7,max_frames/duration))
    subprocess.run(["ffmpeg","-y","-i",str(video),"-vf",f"fps={fps:.4f},scale='min(1920,iw)':-2","-q:v","2",str(out/"frame_%05d.jpg")],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    frames=sorted(out.glob("*.jpg"))
    if len(frames)>max_frames:
        keep={frames[round(i*(len(frames)-1)/(max_frames-1))].name for i in range(max_frames)}
        for p in frames:
            if p.name not in keep:p.unlink(missing_ok=True)
    return sorted(out.glob("*.jpg"))

def run_job(job_id,mode,process_res):
    j=jobs[job_id];j["status"]="running";j["started_at"]=time.time()
    root=Path(j["root"]);imgs=sorted((root/"images").glob("*"))
    def prog(p,m):j["progress"]=float(p);j["message"]=m
    try:
        if len(imgs)<4:raise RuntimeError("Need at least 4 overlapping views for PRO")
        m=get_model()
        result=run_commercial_pipeline(m,[str(p) for p in imgs],root,mode=mode,process_res=process_res,progress=prog)
        j["artifacts"]={"splat":str(result["splat"]),"log":str(result["log"])}
        j["seed"]=result["seed"];j["steps"]=result["steps"];j["status"]="completed";j["progress"]=1.0;j["message"]="Optimized Gaussian world ready";j["completed_at"]=time.time()
    except Exception as e:
        j["status"]="failed";j["message"]=str(e);j["error"]=repr(e);j["completed_at"]=time.time()
        try:
            import torch
            if torch.cuda.is_available():torch.cuda.empty_cache()
        except Exception:pass

@app.get("/health")
def health():
    gpu={}
    try:
        import torch
        gpu={"cuda":torch.cuda.is_available(),"name":torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,"memory_gb":round(torch.cuda.get_device_properties(0).total_memory/2**30,1) if torch.cuda.is_available() else None}
    except Exception as e:gpu={"cuda":False,"error":str(e)}
    return {"ok":True,"commercial":True,"model_id":MODEL_ID,"model_loaded":model is not None,"pipeline":"DA3-BASE → COLMAP seed → gsplat MCMC","gpu":gpu,"jobs":len(jobs)}

@app.post("/v1/jobs")
async def create_job(authorization:Optional[str]=Header(default=None),mode:str=Form("pro"),process_res:int=Form(756),video:Optional[UploadFile]=File(default=None),images:List[UploadFile]=File(default=[])):
    verify_token(authorization);mode=mode if mode in {"pro","ultra"} else "pro"
    if not video and len(images)<4:raise HTTPException(400,"Upload a video or at least 4 overlapping images")
    process_res=max(504,min(1008,int(process_res)));job_id=uuid.uuid4().hex;root=WORKSPACE/job_id;imgdir=root/"images";imgdir.mkdir(parents=True)
    if video:
        vp=root/safe_name(video.filename or "scan.mp4")
        with vp.open("wb") as f:
            while chunk:=await video.read(8*1024*1024):f.write(chunk)
        try:extract_video(vp,imgdir,MAX_FRAMES)
        except Exception as e:raise HTTPException(400,f"Video extraction failed: {e}")
    else:
        for i,u in enumerate(images[:MAX_FRAMES]):
            ext=Path(u.filename or ".jpg").suffix.lower()
            if ext not in {".jpg",".jpeg",".png",".webp",".bmp",".tif",".tiff"}:ext=".jpg"
            p=imgdir/f"{i:05d}{ext}"
            with p.open("wb") as f:
                while chunk:=await u.read(8*1024*1024):f.write(chunk)
    count=len(list(imgdir.glob("*")));jobs[job_id]={"id":job_id,"root":str(root),"status":"pending","message":"Queued","progress":0.0,"frames":count,"mode":mode,"created_at":time.time(),"artifacts":{}}
    executor.submit(run_job,job_id,mode,process_res)
    return {"ok":True,"job_id":job_id,"frames":count,"mode":mode,"status_url":f"/v1/jobs/{job_id}"}

@app.get("/v1/jobs/{job_id}")
def job_status(job_id:str,authorization:Optional[str]=Header(default=None)):
    verify_token(authorization);j=jobs.get(job_id)
    if not j:raise HTTPException(404,"Unknown job")
    return {k:v for k,v in j.items() if k not in {"root","artifacts"}}|{"artifacts":{k:f"/v1/jobs/{job_id}/artifacts/{k}" for k in j.get("artifacts",{})}}

@app.get("/v1/jobs/{job_id}/artifacts/{kind}")
def artifact(job_id:str,kind:str,authorization:Optional[str]=Header(default=None)):
    verify_token(authorization);j=jobs.get(job_id)
    if not j or kind not in j.get("artifacts",{}):raise HTTPException(404,"Artifact not ready")
    p=Path(j["artifacts"][kind]).resolve()
    if not p.is_file() or not str(p).startswith(str(Path(j["root"]).resolve())):raise HTTPException(404,"Artifact unavailable")
    return FileResponse(p,filename=p.name,media_type="application/octet-stream")
