import importlib.util
import tempfile
from pathlib import Path
from types import SimpleNamespace

import numpy as np

spec=importlib.util.spec_from_file_location("commercial_pipeline","gpu-backend/commercial_pipeline.py")
cp=importlib.util.module_from_spec(spec)
spec.loader.exec_module(cp)

n,h,w=4,64,64
rng=np.random.default_rng(42)
images=rng.integers(0,256,size=(n,h,w,3),dtype=np.uint8)
depth=np.ones((n,h,w),dtype=np.float32)*2.0
depth+=rng.normal(0,0.05,size=depth.shape).astype(np.float32)
conf=np.ones((n,h,w),dtype=np.float32)
K=np.repeat(np.array([[[55.0,0.0,31.5],[0.0,55.0,31.5],[0.0,0.0,1.0]]],dtype=np.float32),n,axis=0)
extr=[]
for i in range(n):
    E=np.zeros((3,4),dtype=np.float32)
    E[:3,:3]=np.eye(3,dtype=np.float32)
    E[0,3]=-i*0.12
    extr.append(E)
pred=SimpleNamespace(
    processed_images=images,
    depth=depth,
    conf=conf,
    extrinsics=np.stack(extr),
    intrinsics=K,
)

with tempfile.TemporaryDirectory() as td:
    out=cp.build_colmap_seed(pred,Path(td),max_points=12000)
    root=Path(td)/"sparse"/"0"
    for name in ("cameras.txt","images.txt","points3D.txt"):
        p=root/name
        assert p.exists() and p.stat().st_size>20,name
    assert out["views"]==4
    assert out["seed_points"]>=1000
    cams=[x for x in (root/"cameras.txt").read_text().splitlines() if x and not x.startswith("#")]
    ims=[x for x in (root/"images.txt").read_text().splitlines() if x and not x.startswith("#")]
    pts=[x for x in (root/"points3D.txt").read_text().splitlines() if x and not x.startswith("#")]
    assert len(cams)==4,len(cams)
    assert len(ims)==4,len(ims)
    assert len(pts)==out["seed_points"],(len(pts),out)
    print("COLMAP_SEED_OK",out)
