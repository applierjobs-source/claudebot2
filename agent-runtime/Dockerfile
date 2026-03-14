FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget gnupg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install chromium
RUN playwright install-deps chromium || true

COPY config.py logger.py agent.py main.py ./
COPY tools/ tools/

ENV WORKSPACE=/workspace
RUN mkdir -p /workspace

ENTRYPOINT ["python", "-u", "main.py"]
