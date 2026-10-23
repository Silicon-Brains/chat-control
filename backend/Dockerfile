# syntax=docker/dockerfile:1
FROM python:3.12-slim AS build
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /w
COPY requirements.txt requirements.lock* ./
RUN python -m venv /opt/venv \
 && /opt/venv/bin/pip install -r "$( [ -f requirements.lock ] && echo requirements.lock || echo requirements.txt )"

FROM python:3.12-slim
ENV PATH=/opt/venv/bin:$PATH PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
RUN useradd --system --uid 10001 --home /app app
WORKDIR /app
COPY --from=build /opt/venv /opt/venv
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=4s --start-period=20s \
  CMD python -c "import urllib.request,sys;sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/livez',timeout=3).status==200 else 1)"
# The app writes its own access log without query strings.
CMD ["sh", "-c", "exec uvicorn app.asgi:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY:-1} --no-access-log --proxy-headers --forwarded-allow-ips='*' --timeout-graceful-shutdown 15"]
