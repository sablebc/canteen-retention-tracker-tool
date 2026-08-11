# Django + gunicorn, serving the API on 8001.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Requirements are copied on their own so the dependency layer is only rebuilt
# when they actually change, not on every edit to the application code.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Both live on mounted volumes; see docker-compose.yml. Created here so the
# paths exist even when the compose file is not the thing starting the image.
RUN mkdir -p /data /data/uploads

ENV DJANGO_DB_PATH=/data/db.sqlite3 \
    DJANGO_STATIC_ROOT=/app/staticfiles \
    TRACKER_UPLOAD_DIR=/data/uploads

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8001

ENTRYPOINT ["/entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8001", \
     "--workers", "3", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
