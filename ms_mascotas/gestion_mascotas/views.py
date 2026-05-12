import base64
import hashlib
import hmac
import json
import time

from django.conf import settings
from django.http import HttpResponse, HttpResponseNotAllowed, JsonResponse
from django.utils import dateparse, timezone
from django.views.decorators.csrf import csrf_exempt

from .models import LostPetReport


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b'=').decode('ascii')


def _b64url_decode(raw: str) -> bytes:
    padding = '=' * (-len(raw) % 4)
    return base64.urlsafe_b64decode((raw + padding).encode('ascii'))


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


def _get_access_payload(request) -> dict | None:
    auth_header = request.headers.get('Authorization') or ''
    if not auth_header.startswith('Bearer '):
        return None
    token = auth_header.removeprefix('Bearer ').strip()
    if not token:
        return None
    try:
        payload = _jwt_decode(token, settings.JWT_SECRET)
    except ValueError:
        return None
    if payload.get('typ') != 'access':
        return None
    return payload


def _read_json(request) -> dict:
    if not request.body:
        return {}
    return json.loads(request.body.decode('utf-8'))


def _is_admin(payload: dict | None) -> bool:
    if not payload:
        return False
    return bool(payload.get('is_superuser') or payload.get('is_staff'))

def _normalize_status(value: str) -> str:
    raw = (value or '').strip().lower()
    if raw == 'lost':
        return 'perdido'
    if raw == 'found':
        return 'encontrado'
    return (value or '').strip()


def _report_to_dict(report: LostPetReport, include_image: bool = False) -> dict:
    data = {
        'id': report.id,
        'pet_name': report.pet_name,
        'species': report.species,
        'description': report.description,
        'region': report.region,
        'comuna': report.comuna,
        'latitude': report.latitude,
        'longitude': report.longitude,
        'last_seen_at': report.last_seen_at.isoformat() if report.last_seen_at else None,
        'status': report.status,
        'contact_name': report.contact_name,
        'contact_phone': report.contact_phone,
        'contact_email': report.contact_email,
        'reporter_id': report.reporter_id,
        'is_confirmed': report.is_confirmed,
        'confirmed_at': report.confirmed_at.isoformat() if report.confirmed_at else None,
        'confirmed_by': report.confirmed_by,
        'created_at': report.created_at.isoformat(),
        'updated_at': report.updated_at.isoformat(),
    }
    if include_image:
        data['image_data_url'] = report.image_data_url
    return data


@csrf_exempt
def reports(request):
    if request.method == 'GET':
        payload = _get_access_payload(request)
        include_unconfirmed = (request.GET.get('include_unconfirmed') or '').strip().lower() in {'1', 'true', 'yes'}

        qs = LostPetReport.objects.all().order_by('-created_at')
        if not (_is_admin(payload) and include_unconfirmed):
            qs = qs.filter(is_confirmed=True)

        status_filter = (request.GET.get('status') or '').strip()
        if status_filter:
            qs = qs.filter(status=_normalize_status(status_filter))

        region = (request.GET.get('region') or '').strip()
        if region:
            qs = qs.filter(region__iexact=region)

        comuna = (request.GET.get('comuna') or '').strip()
        if comuna:
            qs = qs.filter(comuna__iexact=comuna)

        species = (request.GET.get('species') or '').strip()
        if species:
            qs = qs.filter(species__iexact=species)

        data = [_report_to_dict(r, include_image=False) for r in qs[:200]]
        return JsonResponse({'results': data}, status=200)

    if request.method == 'POST':
        payload = _get_access_payload(request)
        if payload is None:
            return JsonResponse({'detail': 'unauthorized'}, status=401)

        try:
            body = _read_json(request)
        except json.JSONDecodeError:
            return JsonResponse({'detail': 'invalid_json'}, status=400)

        pet_name = (body.get('pet_name') or '').strip()
        species = (body.get('species') or '').strip()
        description = (body.get('description') or '').strip()
        image_data_url = (body.get('image_data_url') or '').strip()
        region = (body.get('region') or '').strip()
        comuna = (body.get('comuna') or '').strip()
        status_value = _normalize_status(body.get('status') or 'perdido') or 'perdido'
        contact_name = (body.get('contact_name') or '').strip()
        contact_phone = (body.get('contact_phone') or '').strip()
        contact_email = (body.get('contact_email') or '').strip()
        last_seen_at_raw = (body.get('last_seen_at') or '').strip()
        latitude_raw = body.get('latitude', None)
        longitude_raw = body.get('longitude', None)

        if not pet_name:
            return JsonResponse({'detail': 'pet_name_required'}, status=400)

        if not image_data_url:
            return JsonResponse({'detail': 'image_required'}, status=400)

        if not species or not region or not comuna:
            return JsonResponse({'detail': 'species_region_comuna_required'}, status=400)

        if not image_data_url.startswith('data:image/'):
            return JsonResponse({'detail': 'invalid_image'}, status=400)
        if len(image_data_url) > 1_500_000:
            return JsonResponse({'detail': 'image_too_large'}, status=400)

        latitude = None
        longitude = None
        if latitude_raw is not None or longitude_raw is not None:
            try:
                latitude = float(latitude_raw) if latitude_raw is not None and latitude_raw != '' else None
                longitude = float(longitude_raw) if longitude_raw is not None and longitude_raw != '' else None
            except (TypeError, ValueError):
                return JsonResponse({'detail': 'invalid_lat_lng'}, status=400)

            if latitude is None or longitude is None:
                return JsonResponse({'detail': 'lat_lng_both_required'}, status=400)

            if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
                return JsonResponse({'detail': 'invalid_lat_lng'}, status=400)

        last_seen_at = None
        if last_seen_at_raw:
            parsed = dateparse.parse_datetime(last_seen_at_raw)
            if parsed is None:
                return JsonResponse({'detail': 'invalid_last_seen_at'}, status=400)
            last_seen_at = parsed if timezone.is_aware(parsed) else timezone.make_aware(parsed)

        report = LostPetReport.objects.create(
            pet_name=pet_name,
            species=species,
            description=description,
            image_data_url=image_data_url,
            region=region,
            comuna=comuna,
            latitude=latitude,
            longitude=longitude,
            last_seen_at=last_seen_at,
            status=status_value,
            contact_name=contact_name,
            contact_phone=contact_phone,
            contact_email=contact_email,
            reporter_id=int(payload.get('sub')),
            is_confirmed=False,
            confirmed_at=None,
            confirmed_by='',
        )
        return JsonResponse(_report_to_dict(report, include_image=False), status=201)

    return HttpResponseNotAllowed(['GET', 'POST'])


@csrf_exempt
def report_detail(request, report_id: int):
    try:
        report = LostPetReport.objects.get(id=report_id)
    except LostPetReport.DoesNotExist:
        return JsonResponse({'detail': 'not_found'}, status=404)

    if request.method == 'GET':
        if report.is_confirmed:
            return JsonResponse(_report_to_dict(report, include_image=True), status=200)
        payload = _get_access_payload(request)
        if payload is not None:
            try:
                is_owner = int(payload.get('sub')) == report.reporter_id
            except (TypeError, ValueError):
                is_owner = False
            if _is_admin(payload) or is_owner:
                return JsonResponse(_report_to_dict(report, include_image=True), status=200)
        return JsonResponse({'detail': 'not_found'}, status=404)

    payload = _get_access_payload(request)
    if payload is None:
        return JsonResponse({'detail': 'unauthorized'}, status=401)

    try:
        is_owner = int(payload.get('sub')) == report.reporter_id
    except (TypeError, ValueError):
        is_owner = False
    is_admin = _is_admin(payload)
    if not (is_admin or is_owner):
        return JsonResponse({'detail': 'forbidden'}, status=403)

    if request.method in ['PATCH', 'PUT']:
        try:
            body = _read_json(request)
        except json.JSONDecodeError:
            return JsonResponse({'detail': 'invalid_json'}, status=400)

        had_changes = False
        for field in [
            'pet_name',
            'species',
            'description',
            'image_data_url',
            'region',
            'comuna',
            'status',
            'contact_name',
            'contact_phone',
            'contact_email',
        ]:
            if field in body:
                value = (body.get(field) or '').strip()
                if field == 'pet_name' and not value:
                    return JsonResponse({'detail': 'pet_name_required'}, status=400)
                if field == 'status':
                    value = _normalize_status(value)
                if field == 'image_data_url' and value:
                    if not value.startswith('data:image/'):
                        return JsonResponse({'detail': 'invalid_image'}, status=400)
                    if len(value) > 1_500_000:
                        return JsonResponse({'detail': 'image_too_large'}, status=400)
                if getattr(report, field) != value:
                    had_changes = True
                setattr(report, field, value)

        if 'latitude' in body or 'longitude' in body:
            latitude_raw = body.get('latitude', None)
            longitude_raw = body.get('longitude', None)

            if latitude_raw in (None, '') and longitude_raw in (None, ''):
                if report.latitude is not None or report.longitude is not None:
                    had_changes = True
                report.latitude = None
                report.longitude = None
            else:
                try:
                    latitude = float(latitude_raw) if latitude_raw not in (None, '') else None
                    longitude = float(longitude_raw) if longitude_raw not in (None, '') else None
                except (TypeError, ValueError):
                    return JsonResponse({'detail': 'invalid_lat_lng'}, status=400)

                if latitude is None or longitude is None:
                    return JsonResponse({'detail': 'lat_lng_both_required'}, status=400)

                if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
                    return JsonResponse({'detail': 'invalid_lat_lng'}, status=400)

                if report.latitude != latitude or report.longitude != longitude:
                    had_changes = True
                report.latitude = latitude
                report.longitude = longitude

        if 'last_seen_at' in body:
            last_seen_at_raw = (body.get('last_seen_at') or '').strip()
            if not last_seen_at_raw:
                if report.last_seen_at is not None:
                    had_changes = True
                report.last_seen_at = None
            else:
                parsed = dateparse.parse_datetime(last_seen_at_raw)
                if parsed is None:
                    return JsonResponse({'detail': 'invalid_last_seen_at'}, status=400)
                next_dt = parsed if timezone.is_aware(parsed) else timezone.make_aware(parsed)
                if report.last_seen_at != next_dt:
                    had_changes = True
                report.last_seen_at = next_dt

        if had_changes:
            report.is_confirmed = False
            report.confirmed_at = None
            report.confirmed_by = ''

        if 'is_confirmed' in body:
            if not is_admin:
                return JsonResponse({'detail': 'forbidden'}, status=403)
            desired = bool(body.get('is_confirmed'))
            if desired:
                report.is_confirmed = True
                report.confirmed_at = timezone.now()
                report.confirmed_by = (payload.get('username') or '').strip()
            else:
                report.is_confirmed = False
                report.confirmed_at = None
                report.confirmed_by = ''

        report.save()
        return JsonResponse(_report_to_dict(report, include_image=True), status=200)

    if request.method == 'DELETE':
        if not (is_admin or is_owner):
            return JsonResponse({'detail': 'forbidden'}, status=403)
        report.delete()
        return HttpResponse(status=204)

    return HttpResponseNotAllowed(['GET', 'PATCH', 'PUT', 'DELETE'])
