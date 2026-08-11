# syntax=docker/dockerfile:1
FROM python:3.12-slim

# libgomp1 is required by PyTorch / sentence-transformers at runtime.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgomp1 curl \
 && rm -rf /var/lib/apt/lists/*

# Stable cache location so the baked model layer is actually reused at runtime.
ENV HF_HOME=/opt/hf \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the embedding model into the image so containers do not download ~90MB
# on every cold start. This is the single biggest startup win.
ARG EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
RUN python -c "from sentence_transformers import SentenceTransformer; \
SentenceTransformer('${EMBEDDING_MODEL}')"

COPY app ./app
COPY scripts ./scripts

# Non-root. HF_HOME must be readable by this user.
RUN useradd --create-home --uid 10001 appuser \
 && chown -R appuser:appuser /opt/hf /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD curl -fsS http://localhost:8000/health/ready || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
