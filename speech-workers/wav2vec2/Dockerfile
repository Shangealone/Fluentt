FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 HF_HUB_DISABLE_TELEMETRY=1 PYTHONPATH=/srv
WORKDIR /srv
COPY speech-workers/wav2vec2/requirements.lock /srv/requirements.lock
RUN pip install --no-cache-dir --require-hashes -r requirements.lock
COPY backend/app/__init__.py /srv/app/__init__.py
COPY backend/app/speech /srv/app/speech
COPY speech-workers/common.py /srv/common.py
COPY speech-workers/wav2vec2 /srv/wav2vec2
USER 65534:65534
CMD ["uvicorn", "wav2vec2.app:app", "--host", "0.0.0.0", "--port", "8001", "--no-access-log"]
