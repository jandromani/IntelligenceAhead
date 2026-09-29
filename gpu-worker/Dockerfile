FROM ghcr.io/nerfstudio-project/nerfstudio:latest

USER root
WORKDIR /app

RUN python -m pip install --no-cache-dir \
    fastapi==0.118.0 \
    "uvicorn[standard]==0.37.0" \
    python-multipart==0.0.20

COPY main.py /app/main.py
COPY pipeline.py /app/pipeline.py
COPY keyframes.py /app/keyframes.py

RUN python -m py_compile /app/main.py /app/pipeline.py /app/keyframes.py \
    && python -c "import main; print(main.health())"

ENV REALITY_WORKER_ROOT=/data/reality-jobs \
    REALITY_GPU_CONCURRENCY=1 \
    REALITY_MAX_UPLOAD_GB=4 \
    PYTHONUNBUFFERED=1

VOLUME ["/data", "/root/.cache"]
EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
