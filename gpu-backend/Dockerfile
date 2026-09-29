FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04
ENV DEBIAN_FRONTEND=noninteractive PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends python3.10 python3-pip python3.10-dev git ffmpeg build-essential ninja-build && rm -rf /var/lib/apt/lists/*
RUN python3 -m pip install --upgrade pip setuptools wheel
RUN python3 -m pip install --index-url https://download.pytorch.org/whl/cu124 torch==2.6.0 torchvision==0.21.0
RUN python3 -m pip install xformers==0.0.29.post2
WORKDIR /opt
ARG DA3_COMMIT=3d835ec1a5802d64a8b8b15f817a1ab54809bfe4
RUN git clone https://github.com/ByteDance-Seed/Depth-Anything-3.git da3 && cd da3 && git checkout ${DA3_COMMIT} && python3 -m pip install -e ".[all]"
WORKDIR /app
COPY server.py /app/server.py
RUN python3 -m pip install fastapi uvicorn[standard] python-multipart
ENV REALITY_WORKSPACE=/workspace/jobs DA3_DEVICE=cuda DA3_MODEL_ID=depth-anything/DA3NESTED-GIANT-LARGE
VOLUME ["/workspace","/root/.cache/huggingface"]
EXPOSE 8008
CMD ["python3","-m","uvicorn","server:app","--host","0.0.0.0","--port","8008","--workers","1"]
