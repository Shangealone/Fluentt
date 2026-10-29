FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 HF_HUB_DISABLE_TELEMETRY=1 PYTHONPATH=/srv
WORKDIR /srv
COPY speech-workers/wavlm/requirements.lock /srv/requirements.lock
RUN pip install --no-cache-dir --require-hashes -r requirements.lock
COPY backend/app/__init__.py /srv/app/__init__.py
COPY backend/app/speech /srv/app/speech
COPY speech-workers/common.py /srv/common.py
COPY speech-workers/wavlm /srv/wavlm
USER 65534:65534
CMD ["uvicorn", "wavlm.app:app", "--host", "0.0.0.0", "--port", "8002", "--no-access-log"]
