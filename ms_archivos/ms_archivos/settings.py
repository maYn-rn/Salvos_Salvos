"""
Django settings for ms_archivos project.
"""

import os
from pathlib import Path
from urllib.parse import unquote, urlparse

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent


def load_env_file(env_path):
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue

        key, value = line.split('=', 1)
        key = key.strip()
        value = value.strip()
        if value and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        os.environ.setdefault(key, value)


def build_database_config(service_prefix):
    if (os.environ.get('FORZAR_SQLITE') or '').strip().lower() in {'1', 'true', 'yes', 'si', 'sí'}:
        return {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }

    database_url = (
        os.environ.get(f'{service_prefix}_DATABASE_URL')
        or os.environ.get('DATABASE_URL')
        or os.environ.get('SUPABASE_DB_URL')
    )
    if database_url:
        parsed = urlparse(database_url)
        return {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': unquote(parsed.path.lstrip('/') or 'postgres'),
            'USER': unquote(parsed.username or ''),
            'PASSWORD': unquote(parsed.password or ''),
            'HOST': parsed.hostname or 'localhost',
            'PORT': str(parsed.port or 5432),
            'CONN_MAX_AGE': int(
                os.environ.get(f'{service_prefix}_DB_CONN_MAX_AGE', os.environ.get('DB_CONN_MAX_AGE', '60'))
            ),
            'OPTIONS': {
                'sslmode': os.environ.get(f'{service_prefix}_DB_SSLMODE', os.environ.get('DB_SSLMODE', 'require')),
            },
        }

    return {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }


for candidate in (PROJECT_ROOT / '.env', BASE_DIR / '.env'):
    load_env_file(candidate)

SECRET_KEY = 'django-insecure-ms-archivos-dev-key-change-me'

DEBUG = True

ALLOWED_HOSTS = []

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'gestion_archivos',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'ms_archivos.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'ms_archivos.wsgi.application'

DATABASES = {
    'default': build_database_config('ARCHIVOS')
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

JWT_SECRET = os.environ.get('JWT_SECRET', 'dev-jwt-secret-change-me')
RUTA_BASE_ARCHIVOS = BASE_DIR / 'archivos_subidos'
LIMITE_TAMANO_ARCHIVO_BYTES = int(os.environ.get('LIMITE_TAMANO_ARCHIVO_BYTES', '5242880'))
MAXIMO_ARCHIVOS_POR_ENTIDAD = int(os.environ.get('MAXIMO_ARCHIVOS_POR_ENTIDAD', '3'))
