FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04
ENV DEBIAN_FRONTEND=noninteractive PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 MAX_JOBS=8
RUN apt-get update && apt-get install -y --no-install-recommends python3.10 python3-pip python3.10-dev git ffmpeg build-essential ninja-build libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
RUN python3 -m pip install --upgrade pip setuptools wheel
RUN python3 -m pip install --index-url https://download.pytorch.org/whl/cu124 torch==2.6.0 torchvision==0.21.0
RUN python3 -m pip install xformers==0.0.29.post2 "numpy<2"

WORKDIR /opt
ARG DA3_COMMIT=3d835ec1a5802d64a8b8b15f817a1ab54809bfe4
RUN git clone https://github.com/ByteDance-Seed/Depth-Anything-3.git da3 && cd da3 && git checkout ${DA3_COMMIT} && python3 -m pip install -e .

# Keep the exact gsplat revision recommended by DA3, but retain the full repository
# because Reality Compiler uses its Apache-licensed MCMC trainer as the refinement stage.
ARG GSPLAT_COMMIT=0b4dddf04cb687367602c01196913cde6a743d70
RUN git clone https://github.com/nerfstudio-project/gsplat.git gsplat && cd gsplat && git checkout ${GSPLAT_COMMIT} && python3 -m pip install --no-build-isolation -e .
RUN python3 -m pip install     "pycolmap>=3.10,<4" viser     "git+https://github.com/nerfstudio-project/nerfview@4538024fe0d15fd1a0e4d760f3695fc44ca72787"     "imageio[ffmpeg]" scikit-learn tqdm "torchmetrics[image]" opencv-python-headless     "tyro>=0.8.8" Pillow tensorboard tensorly pyyaml matplotlib splines     "git+https://github.com/rahul-goel/fused-ssim@328dc9836f513d00c4b5bc38fe30478b4435cbb5"     "git+https://github.com/harry7557558/fused-bilagrid@90f9788e57d3545e3a033c1038bb9986549632fe"

WORKDIR /app
COPY server.py commercial_pipeline.py /app/
RUN python3 -m pip install fastapi uvicorn[standard] python-multipart

ENV REALITY_WORKSPACE=/workspace/jobs DA3_DEVICE=cuda DA3_MODEL_ID=depth-anything/DA3-BASE GSPLAT_ROOT=/opt/gsplat
VOLUME ["/workspace","/root/.cache/huggingface"]
EXPOSE 8008
CMD ["python3","-m","uvicorn","server:app","--host","0.0.0.0","--port","8008","--workers","1"]
