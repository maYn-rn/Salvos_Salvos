#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export PYTHONUNBUFFERED=1
export SECURITY_SERVICE_BASE_URL="${SECURITY_SERVICE_BASE_URL:-http://127.0.0.1:8002}"
export MASCOTAS_SERVICE_BASE_URL="${MASCOTAS_SERVICE_BASE_URL:-http://127.0.0.1:8001}"
export ADOPTIONS_SERVICE_BASE_URL="${ADOPTIONS_SERVICE_BASE_URL:-http://127.0.0.1:8003}"
export ARCHIVOS_SERVICE_BASE_URL="${ARCHIVOS_SERVICE_BASE_URL:-http://127.0.0.1:8004}"

echo "Aplicando migraciones..."
python "$ROOT_DIR/ms_seguridad/manage.py" migrate
python "$ROOT_DIR/ms_mascotas/manage.py" migrate
python "$ROOT_DIR/ms_adopciones/manage.py" migrate
python "$ROOT_DIR/ms_archivos/manage.py" migrate
python "$ROOT_DIR/bff_web/manage.py" migrate

echo "Levantando microservicios internos..."
python "$ROOT_DIR/ms_seguridad/manage.py" runserver 127.0.0.1:8002 --noreload &
python "$ROOT_DIR/ms_mascotas/manage.py" runserver 127.0.0.1:8001 --noreload &
python "$ROOT_DIR/ms_adopciones/manage.py" runserver 127.0.0.1:8003 --noreload &
python "$ROOT_DIR/ms_archivos/manage.py" runserver 127.0.0.1:8004 --noreload &

echo "Levantando BFF publico en el puerto ${PORT:-10000}..."
exec gunicorn bff_web.wsgi:application --chdir "$ROOT_DIR/bff_web" --bind "0.0.0.0:${PORT:-10000}" --workers 1
