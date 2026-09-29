import math, os, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image

GSPLAT_ROOT=Path(os.getenv("GSPLAT_ROOT","/opt/gsplat"))

def rotmat_to_qvec(R):
    # COLMAP qw,qx,qy,qz convention.
    K=np.array([
        [R[0,0]-R[1,1]-R[2,2],0,0,0],
        [R[1,0]+R[0,1],R[1,1]-R[0,0]-R[2,2],0,0],
        [R[2,0]+R[0,2],R[2,1]+R[1,2],R[2,2]-R[0,0]-R[1,1],0],
        [R[1,2]-R[2,1],R[2,0]-R[0,2],R[0,1]-R[1,0],R[0,0]+R[1,1]+R[2,2]]
    ])/3.0
    vals,vecs=np.linalg.eigh(K)
    q=vecs[[3,0,1,2],np.argmax(vals)]
    if q[0]<0:q=-q
    return q

def _as_homogeneous(E):
    E=np.asarray(E,dtype=np.float64)
    if E.shape==(4,4):return E
    out=np.eye(4,dtype=np.float64);out[:3,:4]=E[:3,:4];return out

def build_colmap_seed(prediction,dataset_dir:Path,max_points=240_000):
    images=np.asarray(prediction.processed_images)
    depth=np.asarray(prediction.depth)
    conf=np.asarray(prediction.conf)
    extr=np.asarray(prediction.extrinsics)
    intr=np.asarray(prediction.intrinsics)
    n,h,w=depth.shape
    imgdir=dataset_dir/"images"; sparse=dataset_dir/"sparse"/"0"
    imgdir.mkdir(parents=True,exist_ok=True);sparse.mkdir(parents=True,exist_ok=True)

    names=[]
    for i,arr in enumerate(images):
        name=f"{i:05d}.png";names.append(name)
        Image.fromarray(np.asarray(arr,dtype=np.uint8)).save(imgdir/name,optimize=True)

    with (sparse/"cameras.txt").open("w") as f:
        f.write("# Camera list\n")
        for i,K in enumerate(intr):
            f.write(f"{i+1} PINHOLE {w} {h} {K[0,0]:.12g} {K[1,1]:.12g} {K[0,2]:.12g} {K[1,2]:.12g}\n")

    with (sparse/"images.txt").open("w") as f:
        f.write("# Image list\n")
        for i,E in enumerate(extr):
            H=_as_homogeneous(E);R=H[:3,:3];t=H[:3,3];q=rotmat_to_qvec(R)
            f.write(f"{i+1} {q[0]:.12g} {q[1]:.12g} {q[2]:.12g} {q[3]:.12g} {t[0]:.12g} {t[1]:.12g} {t[2]:.12g} {i+1} {names[i]}\n\n")

    finite_conf=conf[np.isfinite(conf)]
    cth=float(np.percentile(finite_conf,52)) if finite_conf.size else 0.0
    finite_depth=depth[np.isfinite(depth)&(depth>0)]
    dlo,dhi=(np.percentile(finite_depth,[2,98]) if finite_depth.size else (0.0,1e9))
    target_per=max(4000,max_points//max(1,n))
    stride=max(2,int(math.sqrt((h*w)/target_per)))
    pts=[];cols=[]
    for i in range(n):
        E=_as_homogeneous(extr[i]);C=np.linalg.inv(E);K=np.asarray(intr[i]);invK=np.linalg.inv(K)
        for y in range(stride//2,h,stride):
            for x in range(stride//2,w,stride):
                z=float(depth[i,y,x]);cf=float(conf[i,y,x])
                if not np.isfinite(z) or z<=dlo or z>=dhi or not np.isfinite(cf) or cf<cth: continue
                cam=invK@np.array([x,y,1.0]);cam*=z
                wh=C@np.array([cam[0],cam[1],cam[2],1.0])
                if np.all(np.isfinite(wh[:3])):
                    pts.append(wh[:3]);cols.append(images[i,y,x,:3])
    if len(pts)<1000: raise RuntimeError(f"DA3 seed too sparse: {len(pts)} points")
    pts=np.asarray(pts,dtype=np.float64);cols=np.asarray(cols,dtype=np.uint8)
    if len(pts)>max_points:
        rng=np.random.default_rng(42);idx=rng.choice(len(pts),max_points,replace=False);pts=pts[idx];cols=cols[idx]
    # Robustly remove wild depth outliers after world projection.
    med=np.median(pts,axis=0);rad=np.linalg.norm(pts-med,axis=1);cut=np.percentile(rad,98.5);keep=rad<=cut;pts=pts[keep];cols=cols[keep]

    with (sparse/"points3D.txt").open("w") as f:
        f.write("# 3D point list\n")
        for j,(p,c) in enumerate(zip(pts,cols),1):
            f.write(f"{j} {p[0]:.10g} {p[1]:.10g} {p[2]:.10g} {int(c[0])} {int(c[1])} {int(c[2])} 0\n")
    return {"views":n,"width":w,"height":h,"seed_points":len(pts),"conf_threshold":cth}

def run_commercial_pipeline(model,image_paths,root:Path,mode="pro",process_res=756,progress=None):
    progress=progress or (lambda p,m:None)
    progress(.08,"DA3-BASE: solving multiview depth and cameras")
    pred=model.inference(
        image_paths,
        process_res=process_res,
        process_res_method="upper_bound_resize",
        infer_gs=False,
        ref_view_strategy="saddle_balanced",
    )
    dataset=root/"dataset"
    progress(.24,"Building COLMAP seed from DA3 cameras + depth")
    seed=build_colmap_seed(pred,dataset)
    steps=30_000 if mode=="ultra" else 7_000
    result=root/"gsplat"
    progress(.32,f"gsplat MCMC optimization: {steps:,} steps")
    trainer=GSPLAT_ROOT/"examples"/"simple_trainer.py"
    if not trainer.exists(): raise RuntimeError(f"gsplat trainer missing at {trainer}")
    cmd=[
        sys.executable,str(trainer),"mcmc",
        "--disable_viewer",
        "--data_factor","1",
        "--data_dir",str(dataset),
        "--result_dir",str(result),
        "--test_every","999999",
        "--max_steps",str(steps),
        "--eval_steps","-1",
        "--save_steps",str(steps),
        "--save_ply",
        "--ply_steps",str(steps),
        "--disable_video",
        "--antialiased",
    ]
    log=root/"gsplat.log"
    with log.open("w") as out:
        proc=subprocess.run(cmd,cwd=str(GSPLAT_ROOT/"examples"),stdout=out,stderr=subprocess.STDOUT,text=True)
    if proc.returncode!=0:
        tail="\n".join(log.read_text(errors="ignore").splitlines()[-80:])
        raise RuntimeError(f"gsplat failed ({proc.returncode})\n{tail}")
    plys=sorted((result/"ply").glob("*.ply"),key=lambda p:p.stat().st_mtime)
    if not plys: raise RuntimeError("gsplat completed without exporting a PLY")
    progress(.96,"Gaussian PLY exported")
    return {"splat":plys[-1],"log":log,"seed":seed,"steps":steps}
