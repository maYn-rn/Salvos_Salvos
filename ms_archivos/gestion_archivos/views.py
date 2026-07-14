import base64
import binascii
import hashlib
import hmac
import json
import time
import uuid
from pathlib import Path
from urllib.parse import quote

import requests
from django.conf import settings
from django.http import HttpResponse, HttpResponseNotAllowed, JsonResponse
from django.shortcuts import redirect
from django.views.decorators.csrf import csrf_exempt

from .models import Archivo

TIPOS_MIME_PERMITIDOS = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'application/pdf': '.pdf',
}


def _b64url_decode(texto: str) -> bytes:
    relleno = '=' * (-len(texto) % 4)
    return base64.urlsafe_b64decode((texto + relleno).encode('ascii'))


def _decodificar_jwt(token: str, secreto: str) -> dict:
    try:
        encabezado_b64, carga_b64, firma_b64 = token.split('.')
    except ValueError:
        raise ValueError('invalid_token')

    firma_esperada = hmac.new(
        secreto.encode('utf-8'),
        f'{encabezado_b64}.{carga_b64}'.encode('ascii'),
        hashlib.sha256,
    ).digest()
    firma_real = _b64url_decode(firma_b64)
    if not hmac.compare_digest(firma_esperada, firma_real):
        raise ValueError('invalid_signature')

    carga = json.loads(_b64url_decode(carga_b64).decode('utf-8'))
    expira_en = carga.get('exp')
    if expira_en is None or not isinstance(expira_en, int):
        raise ValueError('missing_exp')
    if int(time.time()) >= expira_en:
        raise ValueError('token_expired')
    return carga


def _obtener_payload_acceso(request) -> dict | None:
    encabezado_autorizacion = request.headers.get('Authorization') or ''
    if not encabezado_autorizacion.startswith('Bearer '):
        return None
    token = encabezado_autorizacion.removeprefix('Bearer ').strip()
    if not token:
        return None
    try:
        payload = _decodificar_jwt(token, settings.JWT_SECRET)
    except ValueError:
        return None
    if payload.get('typ') != 'access':
        return None
    return payload


def _leer_json(request) -> dict:
    if not request.body:
        return {}
    return json.loads(request.body.decode('utf-8'))


def _es_admin(payload: dict | None) -> bool:
    if not payload:
        return False
    return bool(payload.get('is_superuser') or payload.get('is_staff'))


def _normalizar_texto(valor, predeterminado=''):
    return (valor or predeterminado or '').strip()


def _supabase_habilitado() -> bool:
    return bool(
        getattr(settings, 'SUPABASE_URL', '')
        and getattr(settings, 'SUPABASE_SERVICE_ROLE_KEY', '')
        and getattr(settings, 'SUPABASE_STORAGE_BUCKET', '')
    )


def _supabase_public_url(ruta_relativa: str) -> str:
    base = str(getattr(settings, 'SUPABASE_URL', '') or '').rstrip('/')
    bucket = str(getattr(settings, 'SUPABASE_STORAGE_BUCKET', '') or '').strip()
    ruta = quote(ruta_relativa.lstrip('/'), safe='/')
    return f'{base}/storage/v1/object/public/{bucket}/{ruta}'


def _supabase_subir_archivo(ruta_relativa: str, contenido: bytes, tipo_mime: str):
    base = str(getattr(settings, 'SUPABASE_URL', '') or '').rstrip('/')
    bucket = str(getattr(settings, 'SUPABASE_STORAGE_BUCKET', '') or '').strip()
    token = str(getattr(settings, 'SUPABASE_SERVICE_ROLE_KEY', '') or '').strip()
    ruta = quote(ruta_relativa.lstrip('/'), safe='/')
    url = f'{base}/storage/v1/object/{bucket}/{ruta}'
    headers = {
        'Authorization': f'Bearer {token}',
        'apikey': token,
        'Content-Type': tipo_mime,
        'x-upsert': 'true',
    }
    resp = requests.post(url, headers=headers, data=contenido, timeout=20)
    if resp.status_code < 200 or resp.status_code >= 300:
        raise RuntimeError('supabase_upload_failed')


def _archivo_a_dict(archivo: Archivo, request) -> dict:
    if _supabase_habilitado() and bool(getattr(settings, 'SUPABASE_STORAGE_PUBLIC', True)):
        url_descarga = _supabase_public_url(archivo.ruta_relativa)
    else:
        url_descarga = request.build_absolute_uri(f'/api/archivos/{archivo.id}/descargar/')
    return {
        'id': archivo.id,
        'nombre_original': archivo.nombre_original,
        'nombre_guardado': archivo.nombre_guardado,
        'tipo_mime': archivo.tipo_mime,
        'extension': archivo.extension,
        'tamano_bytes': archivo.tamano_bytes,
        'huella_sha256': archivo.huella_sha256,
        'servicio_origen': archivo.servicio_origen,
        'tipo_entidad': archivo.tipo_entidad,
        'id_entidad': archivo.id_entidad,
        'categoria': archivo.categoria,
        'orden': archivo.orden,
        'usuario_cargador_id': archivo.usuario_cargador_id,
        'activo': archivo.activo,
        'creado_en': archivo.creado_en.isoformat(),
        'actualizado_en': archivo.actualizado_en.isoformat(),
        'url_descarga': url_descarga,
    }


def _extraer_desde_base64(contenido_base64: str, nombre_original: str):
    encabezado = ''
    datos_base64 = contenido_base64.strip()
    if datos_base64.startswith('data:'):
        try:
            encabezado, datos_base64 = datos_base64.split(',', 1)
        except ValueError:
            return None, None, None, JsonResponse({'detail': 'contenido_base64_invalido'}, status=400)

    tipo_mime = ''
    if encabezado:
        tipo_mime = encabezado.split(';', 1)[0].removeprefix('data:').strip().lower()

    if tipo_mime not in TIPOS_MIME_PERMITIDOS:
        return None, None, None, JsonResponse({'detail': 'tipo_mime_no_permitido'}, status=400)

    try:
        contenido = base64.b64decode(datos_base64, validate=True)
    except (ValueError, binascii.Error):
        return None, None, None, JsonResponse({'detail': 'contenido_base64_invalido'}, status=400)

    if not nombre_original:
        nombre_original = f'archivo{TIPOS_MIME_PERMITIDOS[tipo_mime]}'

    return contenido, tipo_mime, nombre_original, None


def _extraer_desde_multipart(request):
    archivo_subido = request.FILES.get('archivo')
    if archivo_subido is None:
        return None, None, None, JsonResponse({'detail': 'archivo_requerido'}, status=400)

    tipo_mime = _normalizar_texto(getattr(archivo_subido, 'content_type', '')).lower()
    if tipo_mime not in TIPOS_MIME_PERMITIDOS:
        return None, None, None, JsonResponse({'detail': 'tipo_mime_no_permitido'}, status=400)

    contenido = archivo_subido.read()
    nombre_original = _normalizar_texto(getattr(archivo_subido, 'name', '')) or f'archivo{TIPOS_MIME_PERMITIDOS[tipo_mime]}'
    return contenido, tipo_mime, nombre_original, None


def _asegurar_directorio(ruta: Path):
    ruta.mkdir(parents=True, exist_ok=True)


def _guardar_archivo(contenido: bytes, tipo_mime: str, tipo_entidad: str, id_entidad: int):
    extension = TIPOS_MIME_PERMITIDOS[tipo_mime]
    nombre_guardado = f'{uuid.uuid4().hex}{extension}'
    directorio_relativo = Path(tipo_entidad) / str(id_entidad)
    ruta_relativa = str(directorio_relativo / nombre_guardado).replace('\\', '/')
    if _supabase_habilitado():
        _supabase_subir_archivo(ruta_relativa, contenido, tipo_mime)
        return nombre_guardado, ruta_relativa, extension
    directorio_absoluto = Path(settings.RUTA_BASE_ARCHIVOS) / directorio_relativo
    _asegurar_directorio(directorio_absoluto)
    ruta_absoluta = directorio_absoluto / nombre_guardado
    ruta_absoluta.write_bytes(contenido)
    return nombre_guardado, ruta_relativa, extension


def _ruta_absoluta_desde_relativa(ruta_relativa: str) -> Path:
    return Path(settings.RUTA_BASE_ARCHIVOS) / Path(ruta_relativa)


def _validar_limites(contenido: bytes, tipo_entidad: str, id_entidad: int):
    if not contenido:
        return JsonResponse({'detail': 'archivo_vacio'}, status=400)
    if len(contenido) > settings.LIMITE_TAMANO_ARCHIVO_BYTES:
        return JsonResponse(
            {
                'detail': 'archivo_demasiado_grande',
                'max_bytes': settings.LIMITE_TAMANO_ARCHIVO_BYTES,
            },
            status=400,
        )
    cantidad_actual = Archivo.objects.filter(
        tipo_entidad=tipo_entidad,
        id_entidad=id_entidad,
        activo=True,
    ).count()
    if cantidad_actual >= settings.MAXIMO_ARCHIVOS_POR_ENTIDAD:
        return JsonResponse({'detail': 'maximo_archivos_por_entidad_alcanzado'}, status=400)
    return None


def _obtener_cuerpo(request):
    if request.content_type and request.content_type.startswith('multipart/form-data'):
        return request.POST, None
    try:
        return _leer_json(request), None
    except json.JSONDecodeError:
        return None, JsonResponse({'detail': 'invalid_json'}, status=400)


def _obtener_entero(valor, nombre_campo: str):
    try:
        numero = int(valor)
    except (TypeError, ValueError):
        return None, JsonResponse({'detail': f'{nombre_campo}_invalido'}, status=400)
    if numero < 1:
        return None, JsonResponse({'detail': f'{nombre_campo}_invalido'}, status=400)
    return numero, None


def _usuario_puede_modificar(payload: dict | None, archivo: Archivo) -> bool:
    if payload is None:
        return False
    if _es_admin(payload):
        return True
    try:
        return int(payload.get('sub')) == archivo.usuario_cargador_id
    except (TypeError, ValueError):
        return False


@csrf_exempt
def archivos(request):
    if request.method == 'GET':
        incluir_inactivos = (request.GET.get('incluir_inactivos') or '').strip().lower() in {'1', 'true', 'yes'}
        payload = _obtener_payload_acceso(request)

        consulta = Archivo.objects.all().order_by('orden', '-creado_en')
        if not (_es_admin(payload) and incluir_inactivos):
            consulta = consulta.filter(activo=True)

        servicio_origen = _normalizar_texto(request.GET.get('servicio_origen'))
        if servicio_origen:
            consulta = consulta.filter(servicio_origen__iexact=servicio_origen)

        tipo_entidad = _normalizar_texto(request.GET.get('tipo_entidad'))
        if tipo_entidad:
            consulta = consulta.filter(tipo_entidad__iexact=tipo_entidad)

        id_entidad = _normalizar_texto(request.GET.get('id_entidad'))
        if id_entidad:
            id_entidad_numero, error_id = _obtener_entero(id_entidad, 'id_entidad')
            if error_id:
                return error_id
            consulta = consulta.filter(id_entidad=id_entidad_numero)

        categoria = _normalizar_texto(request.GET.get('categoria'))
        if categoria:
            consulta = consulta.filter(categoria__iexact=categoria)

        resultados = [_archivo_a_dict(archivo, request) for archivo in consulta[:200]]
        return JsonResponse({'results': resultados}, status=200)

    if request.method == 'POST':
        payload = _obtener_payload_acceso(request)
        if payload is None:
            return JsonResponse({'detail': 'unauthorized'}, status=401)

        cuerpo, error_cuerpo = _obtener_cuerpo(request)
        if error_cuerpo:
            return error_cuerpo

        tipo_entidad = _normalizar_texto(cuerpo.get('tipo_entidad'))
        if not tipo_entidad:
            return JsonResponse({'detail': 'tipo_entidad_requerido'}, status=400)

        id_entidad, error_id = _obtener_entero(cuerpo.get('id_entidad'), 'id_entidad')
        if error_id:
            return error_id

        servicio_origen = _normalizar_texto(cuerpo.get('servicio_origen'))
        categoria = _normalizar_texto(cuerpo.get('categoria'), 'general') or 'general'
        orden, error_orden = _obtener_entero(cuerpo.get('orden') or 1, 'orden')
        if error_orden:
            return error_orden

        if request.content_type and request.content_type.startswith('multipart/form-data'):
            contenido, tipo_mime, nombre_original, error_archivo = _extraer_desde_multipart(request)
        else:
            contenido_base64 = _normalizar_texto(cuerpo.get('contenido_base64'))
            nombre_sugerido = _normalizar_texto(cuerpo.get('nombre_original'))
            if not contenido_base64:
                return JsonResponse({'detail': 'contenido_base64_requerido'}, status=400)
            contenido, tipo_mime, nombre_original, error_archivo = _extraer_desde_base64(contenido_base64, nombre_sugerido)

        if error_archivo:
            return error_archivo

        error_limites = _validar_limites(contenido, tipo_entidad, id_entidad)
        if error_limites:
            return error_limites

        try:
            nombre_guardado, ruta_relativa, extension = _guardar_archivo(contenido, tipo_mime, tipo_entidad, id_entidad)
        except Exception:
            return JsonResponse({'detail': 'storage_unavailable'}, status=502)
        archivo = Archivo.objects.create(
            nombre_original=nombre_original,
            nombre_guardado=nombre_guardado,
            ruta_relativa=ruta_relativa,
            tipo_mime=tipo_mime,
            extension=extension,
            tamano_bytes=len(contenido),
            huella_sha256=hashlib.sha256(contenido).hexdigest(),
            servicio_origen=servicio_origen,
            tipo_entidad=tipo_entidad,
            id_entidad=id_entidad,
            categoria=categoria,
            orden=orden,
            usuario_cargador_id=int(payload.get('sub')),
            activo=True,
        )
        return JsonResponse(_archivo_a_dict(archivo, request), status=201)

    return HttpResponseNotAllowed(['GET', 'POST'])


@csrf_exempt
def archivo_detalle(request, archivo_id: int):
    try:
        archivo = Archivo.objects.get(id=archivo_id)
    except Archivo.DoesNotExist:
        return JsonResponse({'detail': 'not_found'}, status=404)

    if request.method == 'GET':
        if not archivo.activo:
            payload = _obtener_payload_acceso(request)
            if not (_es_admin(payload) or _usuario_puede_modificar(payload, archivo)):
                return JsonResponse({'detail': 'not_found'}, status=404)
        return JsonResponse(_archivo_a_dict(archivo, request), status=200)

    payload = _obtener_payload_acceso(request)
    if payload is None:
        return JsonResponse({'detail': 'unauthorized'}, status=401)
    if not _usuario_puede_modificar(payload, archivo):
        return JsonResponse({'detail': 'forbidden'}, status=403)

    if request.method in {'PATCH', 'PUT'}:
        try:
            cuerpo = _leer_json(request)
        except json.JSONDecodeError:
            return JsonResponse({'detail': 'invalid_json'}, status=400)

        cambios = []
        if 'categoria' in cuerpo:
            archivo.categoria = _normalizar_texto(cuerpo.get('categoria'), 'general') or 'general'
            cambios.append('categoria')
        if 'orden' in cuerpo:
            orden, error_orden = _obtener_entero(cuerpo.get('orden'), 'orden')
            if error_orden:
                return error_orden
            archivo.orden = orden
            cambios.append('orden')
        if 'activo' in cuerpo:
            archivo.activo = bool(cuerpo.get('activo'))
            cambios.append('activo')

        if cambios:
            archivo.save(update_fields=cambios + ['actualizado_en'])
        return JsonResponse(_archivo_a_dict(archivo, request), status=200)

    if request.method == 'DELETE':
        if archivo.activo:
            archivo.activo = False
            archivo.save(update_fields=['activo', 'actualizado_en'])
        return HttpResponse(status=204)

    return HttpResponseNotAllowed(['GET', 'PATCH', 'PUT', 'DELETE'])


@csrf_exempt
def archivo_descargar(request, archivo_id: int):
    if request.method != 'GET':
        return HttpResponseNotAllowed(['GET'])

    try:
        archivo = Archivo.objects.get(id=archivo_id, activo=True)
    except Archivo.DoesNotExist:
        return JsonResponse({'detail': 'not_found'}, status=404)

    if _supabase_habilitado() and bool(getattr(settings, 'SUPABASE_STORAGE_PUBLIC', True)):
        return redirect(_supabase_public_url(archivo.ruta_relativa))

    ruta_absoluta = _ruta_absoluta_desde_relativa(archivo.ruta_relativa)
    if not ruta_absoluta.exists() or not ruta_absoluta.is_file():
        return JsonResponse({'detail': 'file_missing'}, status=404)

    respuesta = HttpResponse(ruta_absoluta.read_bytes(), content_type=archivo.tipo_mime)
    respuesta['Content-Length'] = str(archivo.tamano_bytes)
    respuesta['Cache-Control'] = 'public, max-age=86400'
    return respuesta
