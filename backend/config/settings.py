"""
Django settings for the canteen retention-tracking tool.

Generated for early-stage development. Uses SQLite and a permissive
configuration intended for local work only.
"""
from pathlib import Path

from dotenv import load_dotenv
import os

from config.env import (
    DEFAULT_BACKEND_PORT,
    DEFAULT_FRONTEND_PORT,
    build_origins,
    parse_hosts,
    split_env,
)

# BASE_DIR points at the backend/ package root (where manage.py lives).
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from backend/.env if present.
load_dotenv(BASE_DIR / ".env")

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "django-insecure-dev-only-change-me-before-production",
)

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get("DJANGO_DEBUG", "True").lower() in ("1", "true", "yes")

# ---------------------------------------------------------------------------
# Network access
#
# SERVER_HOSTS is the one variable that has to be right for a browser on the
# LAN to reach this server: set it to the machine's address (e.g.
# "192.168.2.17") and the host, CORS, and CSRF settings below are all derived
# from it consistently. Each can still be overridden individually, but doing so
# means keeping them in agreement by hand — and a disagreement between them is
# invisible in the UI, surfacing only as an opaque browser "NetworkError".
# ---------------------------------------------------------------------------
SERVER_HOSTS = parse_hosts(os.environ.get("SERVER_HOSTS", "localhost,127.0.0.1"))

# The ports the two halves are served on, used to build the origins below.
FRONTEND_PORT = os.environ.get("FRONTEND_PORT", DEFAULT_FRONTEND_PORT)
BACKEND_PORT = os.environ.get("BACKEND_PORT", DEFAULT_BACKEND_PORT)

ALLOWED_HOSTS = parse_hosts(os.environ.get("DJANGO_ALLOWED_HOSTS")) or SERVER_HOSTS

# Directory holding the R analysis scripts, a sibling of backend/.
R_SCRIPTS_DIR = BASE_DIR.parent / "r"

# Where tracker exports uploaded through the import endpoint are stored before
# being ingested. Defaults to the repo's data/raw/ alongside manual drops.
TRACKER_UPLOAD_DIR = Path(
    os.environ.get("TRACKER_UPLOAD_DIR", BASE_DIR.parent / "data" / "raw")
)

# Largest tracker export the import endpoint will accept, in bytes.
TRACKER_UPLOAD_MAX_BYTES = int(
    os.environ.get("TRACKER_UPLOAD_MAX_BYTES", 25 * 1024 * 1024)
)


# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "retention",
    "analysis",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Serves the admin's and the browsable API's own static files. Django only
    # does that itself while DEBUG is on, so without this the admin arrives
    # unstyled the moment the app is deployed properly.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    # CorsMiddleware must precede CommonMiddleware so preflight responses and
    # redirects still carry the CORS headers.
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"


# Database
#
# The path is configurable so a container can put the file on a mounted volume:
# left at the default it would live inside the image's layer and every rebuild
# would silently discard the imported tracker data.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": Path(os.environ.get("DJANGO_DB_PATH", BASE_DIR / "db.sqlite3")),
    }
}


# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


# Static files
STATIC_URL = "static/"
STATIC_ROOT = Path(os.environ.get("DJANGO_STATIC_ROOT", BASE_DIR / "staticfiles"))
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"
    },
}

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# Cross-origin access for the separately-served frontend. Derived from
# SERVER_HOSTS + FRONTEND_PORT so it cannot drift out of step with
# ALLOWED_HOSTS; override with DJANGO_CORS_ALLOWED_ORIGINS for an origin that
# does not follow that pattern (a reverse proxy on :80, say). Origins are
# always explicit rather than wildcarded.
CORS_ALLOWED_ORIGINS = split_env(
    os.environ.get("DJANGO_CORS_ALLOWED_ORIGINS")
) or build_origins(SERVER_HOSTS, FRONTEND_PORT)

# The frontend origins, plus this server's own — the latter so the Django admin
# and the browsable API still accept POSTs when reached over the network rather
# than through localhost.
CSRF_TRUSTED_ORIGINS = list(
    dict.fromkeys(CORS_ALLOWED_ORIGINS + build_origins(SERVER_HOSTS, BACKEND_PORT))
)

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
}
