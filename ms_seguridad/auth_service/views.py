import base64
import datetime
import hashlib
import hmac
import json
import time
import uuid

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.http import HttpResponse, HttpResponseNotAllowed, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from .models import FaqEntry, RefreshToken, VeterinariaProfile, VeterinariaVerificationDocument


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b'=').decode('ascii')


def _b64url_decode(raw: str) -> bytes:
    padding = '=' * (-len(raw) % 4)
    return base64.urlsafe_b64decode((raw + padding).encode('ascii'))


def _jwt_encode(payload: dict, secret: str) -> str:
    header = {'alg': 'HS256', 'typ': 'JWT'}
    header_b64 = _b64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
    signing_input = f'{header_b64}.{payload_b64}'.encode('ascii')
    signature = hmac.new(secret.encode('utf-8'), signing_input, hashlib.sha256).digest()
    signature_b64 = _b64url_encode(signature)
    return f'{header_b64}.{payload_b64}.{signature_b64}'


def _jwt_decode(token: str, secret: str) -> dict:
    try:
        header_b64, payload_b64, signature_b64 = token.split('.')
    except ValueError:
        raise ValueError('invalid_token')

    signing_input = f'{header_b64}.{payload_b64}'.encode('ascii')
    expected_sig = hmac.new(secret.encode('utf-8'), signing_input, hashlib.sha256).digest()
    actual_sig = _b64url_decode(signature_b64)
    if not hmac.compare_digest(expected_sig, actual_sig):
        raise ValueError('invalid_signature')

    payload = json.loads(_b64url_decode(payload_b64).decode('utf-8'))
    exp = payload.get('exp')
    if exp is None or not isinstance(exp, int):
        raise ValueError('missing_exp')
    if int(time.time()) >= exp:
        raise ValueError('token_expired')
    return payload


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def _perfil_veterinaria(user):
    try:
        return user.perfil_veterinaria
    except VeterinariaProfile.DoesNotExist:
        return None


def _documento_verificacion_publico(documento: VeterinariaVerificationDocument) -> dict:
    return {
        'id': documento.id,
        'tipo_documento': documento.tipo_documento,
        'tipo_documento_label': documento.get_tipo_documento_display(),
        'archivo_id': documento.archivo_id,
        'archivo_url': documento.archivo_url,
        'archivo_nombre': documento.archivo_nombre,
        'orden': documento.orden,
        'created_at': documento.created_at.isoformat() if documento.created_at else None,
        'updated_at': documento.updated_at.isoformat() if documento.updated_at else None,
    }


def _documentos_verificacion_publicos(perfil: VeterinariaProfile) -> list[dict]:
    documentos = [
        _documento_verificacion_publico(documento)
        for documento in perfil.documentos_verificacion.all()
    ]
    if documentos:
        return documentos

    if perfil.documento_verificacion_archivo_id and perfil.documento_verificacion_url:
        return [
            {
                'id': None,
                'tipo_documento': VeterinariaVerificationDocument.TIPO_OTRO,
                'tipo_documento_label': 'Otro',
                'archivo_id': perfil.documento_verificacion_archivo_id,
                'archivo_url': perfil.documento_verificacion_url,
                'archivo_nombre': perfil.documento_verificacion_nombre,
                'orden': 1,
                'created_at': None,
                'updated_at': None,
            }
        ]

    return []


def _perfil_tiene_documentos_verificacion(perfil: VeterinariaProfile) -> bool:
    return bool(_documentos_verificacion_publicos(perfil))


def _actualizar_documento_legacy(perfil: VeterinariaProfile):
    documentos = list(perfil.documentos_verificacion.all()[:1])
    if documentos:
        primero = documentos[0]
        perfil.documento_verificacion_archivo_id = primero.archivo_id
        perfil.documento_verificacion_url = primero.archivo_url
        perfil.documento_verificacion_nombre = primero.archivo_nombre[:220]
        return

    perfil.documento_verificacion_archivo_id = None
    perfil.documento_verificacion_url = ''
    perfil.documento_verificacion_nombre = ''


def _faq_publico(entry: FaqEntry) -> dict:
    return {
        'id': entry.id,
        'question': entry.question,
        'answer': entry.answer,
        'user_type': entry.user_type,
        'username': entry.username_snapshot or (entry.user.get_username() if entry.user_id else ''),
        'answered_by': entry.answered_by_snapshot or (entry.answered_by.get_username() if entry.answered_by_id else ''),
        'created_at': entry.created_at.isoformat() if entry.created_at else None,
        'answered_at': entry.answered_at.isoformat() if entry.answered_at else None,
        'updated_at': entry.updated_at.isoformat() if entry.updated_at else None,
    }


def _usuario_publico(u) -> dict:
    return {
        'id': u.id,
        'username': u.get_username(),
        'email': getattr(u, 'email', '') or '',
        'first_name': getattr(u, 'first_name', '') or '',
        'last_name': getattr(u, 'last_name', '') or '',
        'is_staff': bool(getattr(u, 'is_staff', False)),
        'is_superuser': bool(getattr(u, 'is_superuser', False)),
        'role': _rol_usuario(u),
        'can_confirm_reports': _puede_confirmar_reportes(u),
        'veterinaria': _perfil_veterinaria_publico(u.perfil_veterinaria, include_documento=True) if _perfil_veterinaria(u) else None,
        'is_active': bool(getattr(u, 'is_active', True)),
        'date_joined': u.date_joined.isoformat() if getattr(u, 'date_joined', None) else None,
    }


def _rol_usuario(user) -> str:
    if bool(getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False)):
        return 'admin'
    if _perfil_veterinaria(user) is not None:
        return 'veterinaria'
    return 'usuario'


def _puede_confirmar_reportes(user) -> bool:
    if bool(getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False)):
        return True
    perfil = _perfil_veterinaria(user)
    return bool(
        perfil
        and perfil.activo
        and perfil.puede_confirmar_reportes
        and perfil.estado_verificacion == VeterinariaProfile.ESTADO_APROBADA
    )


def _perfil_veterinaria_publico(perfil: VeterinariaProfile, include_documento: bool = False) -> dict:
    usuario = perfil.user
    data = {
        'id': perfil.id,
        'user_id': perfil.user_id,
        'nombre_veterinaria': perfil.nombre_veterinaria,
        'telefono': perfil.telefono,
        'region': perfil.region,
        'comuna': perfil.comuna,
        'direccion': perfil.direccion,
        'descripcion': perfil.descripcion,
        'sitio_web': perfil.sitio_web,
        'latitude': perfil.latitude,
        'longitude': perfil.longitude,
        'activo': perfil.activo,
        'puede_confirmar_reportes': perfil.puede_confirmar_reportes,
        'estado_verificacion': perfil.estado_verificacion,
        'comentario_revision': perfil.comentario_revision,
        'verificado_por': perfil.verificado_por,
        'verificado_en': perfil.verificado_en.isoformat() if perfil.verificado_en else None,
        'owner_name': f'{getattr(usuario, "first_name", "")} {getattr(usuario, "last_name", "")}'.strip(),
        'owner_email': getattr(usuario, 'email', '') or '',
        'created_at': perfil.created_at.isoformat() if perfil.created_at else None,
        'updated_at': perfil.updated_at.isoformat() if perfil.updated_at else None,
    }
    if include_documento:
        data['documento_verificacion_archivo_id'] = perfil.documento_verificacion_archivo_id
        data['documento_verificacion_url'] = perfil.documento_verificacion_url
        data['documento_verificacion_nombre'] = perfil.documento_verificacion_nombre
        data['documentos_verificacion'] = _documentos_verificacion_publicos(perfil)
    return data


def _issue_access_token(user) -> str:
    now = int(time.time())
    exp = now + int(settings.JWT_ACCESS_TTL_SECONDS)
    payload = {
        'typ': 'access',
        'sub': user.id,
        'username': user.get_username(),
        'is_staff': bool(getattr(user, 'is_staff', False)),
        'is_superuser': bool(getattr(user, 'is_superuser', False)),
        'role': _rol_usuario(user),
        'can_confirm_reports': _puede_confirmar_reportes(user),
        'iat': now,
        'exp': exp,
    }
    return _jwt_encode(payload, settings.JWT_SECRET)


def _issue_refresh_token(user) -> tuple[str, str, datetime.datetime]:
    now = int(time.time())
    exp = now + int(settings.JWT_REFRESH_TTL_SECONDS)
    jti = uuid.uuid4().hex
    payload = {
        'typ': 'refresh',
        'sub': user.id,
        'jti': jti,
        'iat': now,
        'exp': exp,
    }
    token = _jwt_encode(payload, settings.JWT_SECRET)
    expires_at = datetime.datetime.fromtimestamp(exp, tz=datetime.UTC)
    return token, jti, expires_at


def _issue_tokens_and_persist_refresh(user) -> dict:
    access = _issue_access_token(user)
    refresh, jti, expires_at = _issue_refresh_token(user)
    RefreshToken.objects.create(
        user=user,
        jti=jti,
        token_hash=_token_hash(refresh),
        expires_at=expires_at,
    )
    return {'access': access, 'refresh': refresh}


def _get_bearer_token(request) -> str | None:
    auth_header = request.headers.get('Authorization') or ''
    if not auth_header.startswith('Bearer '):
        return None
    return auth_header.removeprefix('Bearer ').strip() or None


def _read_json(request) -> dict:
    if not request.body:
        return {}
    return json.loads(request.body.decode('utf-8'))


def _authenticate_access_request(request):
    token = _get_bearer_token(request)
    if token is None:
        return None, JsonResponse({'detail': 'missing_access'}, status=401)

    try:
        payload = _jwt_decode(token, settings.JWT_SECRET)
    except ValueError:
        return None, JsonResponse({'detail': 'invalid_access'}, status=401)

    if payload.get('typ') != 'access':
        return None, JsonResponse({'detail': 'invalid_access'}, status=401)

    User = get_user_model()
    try:
        user = User.objects.get(id=int(payload.get('sub')))
    except Exception:
        return None, JsonResponse({'detail': 'invalid_access'}, status=401)

    return user, None


@csrf_exempt
def register(request):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])

    try:
        body = _read_json(request)
    except json.JSONDecodeError:
        return JsonResponse({'detail': 'invalid_json'}, status=400)

    username = (body.get('username') or '').strip()
    password = body.get('password') or ''
    email = (body.get('email') or '').strip() or None
    first_name = (body.get('first_name') or '').strip()
    last_name = (body.get('last_name') or '').strip()
    account_type = (body.get('account_type') or 'usuario').strip().lower() or 'usuario'

    if not username or not password:
        return JsonResponse({'detail': 'username_and_password_required'}, status=400)

    if not email:
        return JsonResponse({'detail': 'email_required'}, status=400)

    if not first_name or not last_name:
        return JsonResponse({'detail': 'first_and_last_name_required'}, status=400)

    if account_type not in {'usuario', 'veterinaria'}:
        return JsonResponse({'detail': 'invalid_account_type'}, status=400)

    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse({'detail': 'invalid_email'}, status=400)

    datos_veterinaria = None
    if account_type == 'veterinaria':
        nombre_veterinaria = (body.get('nombre_veterinaria') or '').strip()
        telefono_veterinaria = (body.get('telefono_veterinaria') or '').strip()
        region = (body.get('region') or '').strip()
        comuna = (body.get('comuna') or '').strip()
        direccion = (body.get('direccion_veterinaria') or body.get('direccion') or '').strip()
        descripcion = (body.get('descripcion_veterinaria') or '').strip()
        sitio_web = (body.get('sitio_web_veterinaria') or '').strip()
        latitude_raw = body.get('latitude')
        longitude_raw = body.get('longitude')

        if sitio_web and not sitio_web.startswith(('http://', 'https://')):
            sitio_web = f'https://{sitio_web}'

        if not nombre_veterinaria or not telefono_veterinaria or not region or not comuna or not direccion:
            return JsonResponse({'detail': 'veterinaria_fields_required'}, status=400)

        try:
            latitude = float(latitude_raw)
            longitude = float(longitude_raw)
        except (TypeError, ValueError):
            return JsonResponse({'detail': 'invalid_lat_lng'}, status=400)

        if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
            return JsonResponse({'detail': 'invalid_lat_lng'}, status=400)

        datos_veterinaria = {
            'nombre_veterinaria': nombre_veterinaria[:180],
            'telefono': telefono_veterinaria[:40],
            'region': region[:120],
            'comuna': comuna[:120],
            'direccion': direccion[:220],
            'descripcion': descripcion,
            'sitio_web': sitio_web,
            'latitude': latitude,
            'longitude': longitude,
            'activo': False,
            'puede_confirmar_reportes': False,
            'estado_verificacion': VeterinariaProfile.ESTADO_PENDIENTE,
        }

    User = get_user_model()
    try:
        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                password=password,
                email=email,
                first_name=first_name[:150],
                last_name=last_name[:150],
            )
            if datos_veterinaria is not None:
                VeterinariaProfile.objects.create(user=user, **datos_veterinaria)
    except IntegrityError:
        return JsonResponse({'detail': 'username_already_exists'}, status=409)

    tokens = _issue_tokens_and_persist_refresh(user)
    return JsonResponse(tokens, status=201)


@csrf_exempt
def login(request):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])

    try:
        body = _read_json(request)
    except json.JSONDecodeError:
        return JsonResponse({'detail': 'invalid_json'}, status=400)

    username = (body.get('username') or '').strip()
    password = body.get('password') or ''

    if not username or not password:
        return JsonResponse({'detail': 'username_and_password_required'}, status=400)

    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({'detail': 'invalid_credentials'}, status=401)

    tokens = _issue_tokens_and_persist_refresh(user)
    return JsonResponse(tokens, status=200)


@csrf_exempt
def refresh(request):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])

    try:
        body = _read_json(request)
    except json.JSONDecodeError:
        return JsonResponse({'detail': 'invalid_json'}, status=400)

    refresh_token = body.get('refresh') or ''
    if not refresh_token:
        return JsonResponse({'detail': 'refresh_required'}, status=400)

    try:
        payload = _jwt_decode(refresh_token, settings.JWT_SECRET)
    except ValueError:
        return JsonResponse({'detail': 'invalid_refresh'}, status=401)

    if payload.get('typ') != 'refresh':
        return JsonResponse({'detail': 'invalid_refresh'}, status=401)

    token_hash = _token_hash(refresh_token)
    try:
        token_row = RefreshToken.objects.select_related('user').get(token_hash=token_hash)
    except RefreshToken.DoesNotExist:
        return JsonResponse({'detail': 'invalid_refresh'}, status=401)

    now = timezone.now()
    if token_row.revoked_at is not None or token_row.expires_at <= now:
        return JsonResponse({'detail': 'invalid_refresh'}, status=401)

    if int(payload.get('sub')) != token_row.user_id:
        return JsonResponse({'detail': 'invalid_refresh'}, status=401)

    access = _issue_access_token(token_row.user)
    new_refresh, new_jti, new_expires_at = _issue_refresh_token(token_row.user)
    RefreshToken.objects.create(
        user=token_row.user,
        jti=new_jti,
        token_hash=_token_hash(new_refresh),
        expires_at=new_expires_at,
    )

    token_row.revoked_at = now
    token_row.replaced_by_jti = new_jti
    token_row.save(update_fields=['revoked_at', 'replaced_by_jti'])

    return JsonResponse({'access': access, 'refresh': new_refresh}, status=200)


@csrf_exempt
def logout(request):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])

    try:
        body = _read_json(request)
    except json.JSONDecodeError:
        return JsonResponse({'detail': 'invalid_json'}, status=400)

    refresh_token = body.get('refresh') or ''
    if not refresh_token:
        return JsonResponse({'detail': 'refresh_required'}, status=400)

    token_hash = _token_hash(refresh_token)
    now = timezone.now()
    RefreshToken.objects.filter(token_hash=token_hash, revoked_at__isnull=True).update(revoked_at=now)
    return HttpResponse(status=204)


def me(request):
    if request.method != 'GET':
        return HttpResponseNotAllowed(['GET'])

    user, auth_error = _authenticate_access_request(request)
    if auth_error is not None:
        return auth_error
    perfil_veterinaria = _perfil_veterinaria(user)

    return JsonResponse(
        {
            'id': user.id,
            'username': user.get_username(),
            'email': getattr(user, 'email', '') or '',
            'first_name': getattr(user, 'first_name', '') or '',
            'last_name': getattr(user, 'last_name', '') or '',
            'is_staff': bool(getattr(user, 'is_staff', False)),
            'is_superuser': bool(getattr(user, 'is_superuser', False)),
            'role': _rol_usuario(user),
            'can_confirm_reports': _puede_confirmar_reportes(user),
            'veterinaria': _perfil_veterinaria_publico(perfil_veterinaria, include_documento=True) if perfil_veterinaria else None,
            'is_active': bool(getattr(user, 'is_active', True)),
            'date_joined': user.date_joined.isoformat() if getattr(user, 'date_joined', None) else None,
        },
        status=200,
    )


def users(request):
    if request.method not in {'GET', 'POST'}:
        return HttpResponseNotAllowed(['GET', 'POST'])

    requester, auth_error = _authenticate_access_request(request)
    if auth_error is not None:
        return auth_error

    if not (getattr(requester, 'is_staff', False) or getattr(requester, 'is_superuser', False)):
        return JsonResponse({'detail': 'forbidden'}, status=403)

    User = get_user_model()
    if request.method == 'POST':
        try:
            body = _read_json(request)
        except json.JSONDecodeError:
            return JsonResponse({'detail': 'invalid_json'}, status=400)

        username = (body.get('username') or '').strip()
        password = body.get('password') or ''
        email = (body.get('email') or '').strip()
        first_name = (body.get('first_name') or '').strip()
        last_name = (body.get('last_name') or '').strip()

        if not username or not password:
            return JsonResponse({'detail': 'username_and_password_required'}, status=400)
        if not email:
            return JsonResponse({'detail': 'email_required'}, status=400)
        if not first_name or not last_name:
            return JsonResponse({'detail': 'first_and_last_name_required'}, status=400)

        try:
            validate_email(email)
        except ValidationError:
            return JsonResponse({'detail': 'invalid_email'}, status=400)

        try:
            user = User.objects.create_user(
                username=username,
                password=password,
                email=email,
                first_name=first_name[:150],
                last_name=last_name[:150],
                is_staff=True,
                is_superuser=True,
            )
        except IntegrityError:
            return JsonResponse({'detail': 'username_already_exists'}, status=409)

        return JsonResponse(_usuario_publico(user), status=201)

    qs = User.objects.all().select_related('perfil_veterinaria').prefetch_related('perfil_veterinaria__documentos_verificacion').order_by('-date_joined')[:500]
    data = [_usuario_publico(u) for u in qs]
    return JsonResponse({'results': data}, status=200)


@csrf_exempt
def user_detail(request, user_id: int):
    if request.method != 'PATCH':
        return HttpResponseNotAllowed(['PATCH'])

    requester, auth_error = _authenticate_access_request(request)
    if auth_error is not None:
        return auth_error

    if not (getattr(requester, 'is_staff', False) or getattr(requester, 'is_superuser', False)):
        return JsonResponse({'detail': 'forbidden'}, status=403)

    User = get_user_model()
    try:
        target = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({'detail': 'not_found'}, status=404)

    try:
        body = _read_json(request)
    except json.JSONDecodeError:
        return JsonResponse({'detail': 'invalid_json'}, status=400)

    cambios = []
    if 'is_staff' in body:
        nuevo_staff = bool(body.get('is_staff'))
        if target.id == requester.id and not nuevo_staff:
            return JsonResponse({'detail': 'cannot_remove_own_admin_access'}, status=400)
        target.is_staff = nuevo_staff
        target.is_superuser = nuevo_staff
        cambios.extend(['is_staff', 'is_superuser'])

    if 'is_active' in body:
        nuevo_activo = bool(body.get('is_active'))
        if target.id == requester.id and not nuevo_activo:
            return JsonResponse({'detail': 'cannot_deactivate_own_account'}, status=400)
        target.is_active = nuevo_activo
        cambios.append('is_active')

    if not cambios:
        return JsonResponse({'detail': 'no_changes_requested'}, status=400)

    target.save(update_fields=cambios)
    return JsonResponse(_usuario_publico(target), status=200)


@csrf_exempt
def faqs(request):
    if request.method == 'GET':
        data = [_faq_publico(entry) for entry in FaqEntry.objects.all()[:200]]
        return JsonResponse({'results': data}, status=200)

    if request.method != 'POST':
        return HttpResponseNotAllowed(['GET', 'POST'])

    user, auth_error = _authenticate_access_request(request)
    if auth_error is not None:
        return auth_error

    try:
        body = _read_json(request)
    except json.JSONDecodeError:
        return JsonResponse({'detail': 'invalid_json'}, status=400)

    question = (body.get('question') or '').strip()
    if not question:
        return JsonResponse({'detail': 'question_required'}, status=400)

    user_type = FaqEntry.USER_TYPE_ADMIN if _rol_usuario(user) == 'admin' else FaqEntry.USER_TYPE_USER
    entry = FaqEntry.objects.create(
        question=question,
        user=user,
        user_type=user_type,
        username_snapshot=user.get_username(),
    )
    return JsonResponse(_faq_publico(entry), status=201)


@csrf_exempt
def faq_detail(request, faq_id: int):
    if request.method != 'PATCH':
        return HttpResponseNotAllowed(['PATCH'])

    user, auth_error = _authenticate_access_request(request)
    if auth_error is not None:
        return auth_error

    if _rol_usuario(user) != 'admin':
        return JsonResponse({'detail': 'forbidden'}, status=403)

    try:
        entry = FaqEntry.objects.get(id=faq_id)
    except FaqEntry.DoesNotExist:
        return JsonResponse({'detail': 'not_found'}, status=404)

    try:
        body = _read_json(request)
    except json.JSONDecodeError:
        return JsonResponse({'detail': 'invalid_json'}, status=400)

    answer = body.get('answer')
    if answer is None:
        return JsonResponse({'detail': 'answer_required'}, status=400)

    answer = str(answer).strip()
    if not answer:
        return JsonResponse({'detail': 'answer_required'}, status=400)

    entry.answer = answer
    entry.answered_by = user
    entry.answered_by_snapshot = user.get_username()
    entry.answered_at = timezone.now()
    entry.save(update_fields=['answer', 'answered_by', 'answered_by_snapshot', 'answered_at', 'updated_at'])
    return JsonResponse(_faq_publico(entry), status=200)


def veterinarias(request):
    if request.method != 'GET':
        return HttpResponseNotAllowed(['GET'])

    perfiles = (
        VeterinariaProfile.objects.select_related('user').prefetch_related('documentos_verificacion')
        .filter(activo=True, estado_verificacion=VeterinariaProfile.ESTADO_APROBADA)
        .order_by('nombre_veterinaria')[:500]
    )
    return JsonResponse({'results': [_perfil_veterinaria_publico(perfil) for perfil in perfiles]}, status=200)


@csrf_exempt
def veterinaria_detail(request, veterinaria_id: int):
    if request.method == 'GET':
        payload = _get_bearer_token(request)
        payload_decoded = None
        if payload is not None:
            try:
                payload_decoded = _jwt_decode(payload, settings.JWT_SECRET)
            except ValueError:
                payload_decoded = None

        try:
            perfil = VeterinariaProfile.objects.select_related('user').prefetch_related('documentos_verificacion').get(id=veterinaria_id)
        except VeterinariaProfile.DoesNotExist:
            return JsonResponse({'detail': 'not_found'}, status=404)

        puede_ver_privado = False
        if payload_decoded and payload_decoded.get('typ') == 'access':
            try:
                user_id = int(payload_decoded.get('sub'))
            except (TypeError, ValueError):
                user_id = None
            puede_ver_privado = bool(
                user_id == perfil.user_id
                or payload_decoded.get('is_staff')
                or payload_decoded.get('is_superuser')
            )

        if not puede_ver_privado and not (perfil.activo and perfil.estado_verificacion == VeterinariaProfile.ESTADO_APROBADA):
            return JsonResponse({'detail': 'not_found'}, status=404)

        return JsonResponse(_perfil_veterinaria_publico(perfil, include_documento=puede_ver_privado), status=200)

    if request.method == 'PATCH':
        requester, auth_error = _authenticate_access_request(request)
        if auth_error is not None:
            return auth_error

        try:
            perfil = VeterinariaProfile.objects.select_related('user').prefetch_related('documentos_verificacion').get(id=veterinaria_id)
        except VeterinariaProfile.DoesNotExist:
            return JsonResponse({'detail': 'not_found'}, status=404)

        try:
            body = _read_json(request)
        except json.JSONDecodeError:
            return JsonResponse({'detail': 'invalid_json'}, status=400)

        es_admin = bool(getattr(requester, 'is_staff', False) or getattr(requester, 'is_superuser', False))
        es_dueno = requester.id == perfil.user_id

        if not (es_admin or es_dueno):
            return JsonResponse({'detail': 'forbidden'}, status=403)

        if es_dueno:
            documentos_input = body.get('documentos_verificacion')
            if documentos_input is None:
                documentos_input = [{
                    'tipo_documento': VeterinariaVerificationDocument.TIPO_OTRO,
                    'archivo_id': body.get('documento_verificacion_archivo_id'),
                    'archivo_url': body.get('documento_verificacion_url'),
                    'archivo_nombre': body.get('documento_verificacion_nombre'),
                }]

            if not isinstance(documentos_input, list) or not documentos_input:
                return JsonResponse({'detail': 'documento_verificacion_requerido'}, status=400)

            documentos_normalizados = []
            for index, item in enumerate(documentos_input, start=1):
                if not isinstance(item, dict):
                    return JsonResponse({'detail': 'documento_verificacion_invalido'}, status=400)

                tipo_documento = (item.get('tipo_documento') or '').strip().lower() or VeterinariaVerificationDocument.TIPO_OTRO
                if tipo_documento not in {valor for valor, _ in VeterinariaVerificationDocument.TIPOS_DOCUMENTO}:
                    return JsonResponse({'detail': 'tipo_documento_invalido'}, status=400)

                archivo_url = (item.get('archivo_url') or '').strip()
                archivo_nombre = (item.get('archivo_nombre') or '').strip()
                try:
                    archivo_id = int(item.get('archivo_id'))
                except (TypeError, ValueError):
                    return JsonResponse({'detail': 'documento_verificacion_invalido'}, status=400)

                if not archivo_url:
                    return JsonResponse({'detail': 'documento_verificacion_invalido'}, status=400)

                documentos_normalizados.append(
                    {
                        'tipo_documento': tipo_documento,
                        'archivo_id': archivo_id,
                        'archivo_url': archivo_url,
                        'archivo_nombre': archivo_nombre[:220],
                        'orden': index,
                    }
                )

            with transaction.atomic():
                perfil.documentos_verificacion.all().delete()
                VeterinariaVerificationDocument.objects.bulk_create(
                    [
                        VeterinariaVerificationDocument(
                            veterinaria=perfil,
                            tipo_documento=item['tipo_documento'],
                            archivo_id=item['archivo_id'],
                            archivo_url=item['archivo_url'],
                            archivo_nombre=item['archivo_nombre'],
                            orden=item['orden'],
                        )
                        for item in documentos_normalizados
                    ]
                )
                _actualizar_documento_legacy(perfil)
            perfil.estado_verificacion = VeterinariaProfile.ESTADO_PENDIENTE
            perfil.activo = False
            perfil.puede_confirmar_reportes = False
            perfil.comentario_revision = ''
            perfil.verificado_por = ''
            perfil.verificado_en = None
            perfil.save()
            perfil.refresh_from_db()
            return JsonResponse(_perfil_veterinaria_publico(perfil, include_documento=True), status=200)

        estado = (body.get('estado_verificacion') or '').strip().lower()
        comentario = (body.get('comentario_revision') or '').strip()
        if estado not in {
            VeterinariaProfile.ESTADO_PENDIENTE,
            VeterinariaProfile.ESTADO_APROBADA,
            VeterinariaProfile.ESTADO_RECHAZADA,
        }:
            return JsonResponse({'detail': 'estado_verificacion_invalido'}, status=400)

        if estado == VeterinariaProfile.ESTADO_APROBADA and not _perfil_tiene_documentos_verificacion(perfil):
            return JsonResponse({'detail': 'documento_verificacion_requerido'}, status=400)

        perfil.estado_verificacion = estado
        perfil.comentario_revision = comentario
        perfil.verificado_por = requester.get_username()
        perfil.verificado_en = timezone.now()
        if estado == VeterinariaProfile.ESTADO_APROBADA:
            perfil.activo = True
            perfil.puede_confirmar_reportes = True
        else:
            perfil.activo = False
            perfil.puede_confirmar_reportes = False
        perfil.save()
        return JsonResponse(_perfil_veterinaria_publico(perfil, include_documento=True), status=200)

    return HttpResponseNotAllowed(['GET', 'PATCH'])

