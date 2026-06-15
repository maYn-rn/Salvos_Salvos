import base64
import hashlib
import hmac
import json
import re
import time

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db.models import Q
from django.http import HttpResponse, HttpResponseNotAllowed, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from .models import AdoptionListing


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


def _normalize_publisher_type(value: str) -> str:
    raw = (value or '').strip().lower()
    if raw in {'persona', 'albergue'}:
        return raw
    return (value or '').strip()


def _parse_bool(value):
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    raw = str(value).strip().lower()
    if raw == '':
        return None
    if raw in {'1', 'true', 'yes', 'si', 'sí'}:
        return True
    if raw in {'0', 'false', 'no'}:
        return False
    return None


def _normalize_images(value) -> list[dict]:
    if value in (None, ''):
        return []
    if not isinstance(value, list):
        raise ValueError('invalid_images')

    normalized = []
    for index, item in enumerate(value[:3]):
        if not isinstance(item, dict):
            raise ValueError('invalid_images')

        image_id = item.get('id')
        if image_id in (None, ''):
            image_id = None
        else:
            try:
                image_id = int(image_id)
            except (TypeError, ValueError):
                raise ValueError('invalid_images')

        image_url = (item.get('url_descarga') or item.get('url') or '').strip()
        if not image_url:
            raise ValueError('invalid_images')

        category = (item.get('categoria') or ('principal' if index == 0 else 'galeria')).strip() or 'galeria'

        try:
            order = int(item.get('orden', index + 1))
        except (TypeError, ValueError):
            raise ValueError('invalid_images')
        if order < 1:
            raise ValueError('invalid_images')

        normalized.append({
            'id': image_id,
            'url_descarga': image_url,
            'categoria': category,
            'orden': order,
        })

    normalized.sort(key=lambda image: (image.get('orden') or 0, image.get('id') or 0))
    return normalized


def _public_images(listing: AdoptionListing) -> list[dict]:
    try:
        images = _normalize_images(listing.imagenes)
    except ValueError:
        images = []
    if images:
        return images
    if listing.image_data_url:
        return [{
            'id': None,
            'url_descarga': listing.image_data_url,
            'categoria': 'principal',
            'orden': 1,
        }]
    return []


def _listing_to_dict(listing: AdoptionListing, include_image: bool = False) -> dict:
    images = _public_images(listing)
    cover_image = images[0]['url_descarga'] if images else listing.image_data_url
    data = {
        'id': listing.id,
        'pet_name': listing.pet_name,
        'species': listing.species,
        'breed': listing.breed,
        'age_label': listing.age_label,
        'sex': listing.sex,
        'size': listing.size,
        'description': listing.description,
        'color': listing.color,
        'is_sterilized': listing.is_sterilized,
        'vaccines_up_to_date': listing.vaccines_up_to_date,
        'has_microchip': listing.has_microchip,
        'adoption_reason': listing.adoption_reason,
        'behavior_notes': listing.behavior_notes,
        'region': listing.region,
        'comuna': listing.comuna,
        'latitude': listing.latitude,
        'longitude': listing.longitude,
        'publisher_type': listing.publisher_type,
        'shelter_name': listing.shelter_name,
        'health_notes': listing.health_notes,
        'contact_name': listing.contact_name,
        'contact_phone': listing.contact_phone,
        'contact_email': listing.contact_email,
        'publisher_id': listing.publisher_id,
        'is_confirmed': listing.is_confirmed,
        'confirmed_at': listing.confirmed_at.isoformat() if listing.confirmed_at else None,
        'confirmed_by': listing.confirmed_by,
        'created_at': listing.created_at.isoformat(),
        'updated_at': listing.updated_at.isoformat(),
        'image_data_url': cover_image,
    }
    if include_image:
        data['imagenes'] = images
    return data


def _validate_contact_fields(contact_phone: str, contact_email: str) -> JsonResponse | None:
    if not contact_phone and not contact_email:
        return JsonResponse({'detail': 'contact_required'}, status=400)

    if contact_phone:
        if not re.fullmatch(r'^[+\d][\d\s\-().]{5,30}$', contact_phone):
            return JsonResponse({'detail': 'invalid_contact_phone'}, status=400)

    if contact_email:
        try:
            validate_email(contact_email)
        except ValidationError:
            return JsonResponse({'detail': 'invalid_contact_email'}, status=400)

    return None


def _parse_coordinates(latitude_raw, longitude_raw):
    latitude = None
    longitude = None
    if latitude_raw is not None or longitude_raw is not None:
        try:
            latitude = float(latitude_raw) if latitude_raw not in (None, '') else None
            longitude = float(longitude_raw) if longitude_raw not in (None, '') else None
        except (TypeError, ValueError):
            return None, None, JsonResponse({'detail': 'invalid_lat_lng'}, status=400)

        if latitude is None or longitude is None:
            return None, None, JsonResponse({'detail': 'lat_lng_both_required'}, status=400)

        if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
            return None, None, JsonResponse({'detail': 'invalid_lat_lng'}, status=400)

    return latitude, longitude, None


@csrf_exempt
def adoptions(request):
    if request.method == 'GET':
        payload = _get_access_payload(request)
        include_unconfirmed = (request.GET.get('include_unconfirmed') or '').strip().lower() in {'1', 'true', 'yes'}
        include_image = (request.GET.get('include_image') or '').strip().lower() in {'1', 'true', 'yes'}
        include_mine = (request.GET.get('include_mine') or '').strip().lower() in {'1', 'true', 'yes'}

        qs = AdoptionListing.objects.all().order_by('-created_at')
        if not (_is_admin(payload) and include_unconfirmed):
            if payload is not None and include_mine:
                try:
                    user_id = int(payload.get('sub'))
                except (TypeError, ValueError):
                    user_id = None
                if user_id is not None:
                    qs = qs.filter(Q(is_confirmed=True) | Q(publisher_id=user_id))
                else:
                    qs = qs.filter(is_confirmed=True)
            else:
                qs = qs.filter(is_confirmed=True)

        region = (request.GET.get('region') or '').strip()
        if region:
            qs = qs.filter(region__iexact=region)

        comuna = (request.GET.get('comuna') or '').strip()
        if comuna:
            qs = qs.filter(comuna__iexact=comuna)

        species = (request.GET.get('species') or '').strip()
        if species:
            qs = qs.filter(species__iexact=species)

        publisher_type = _normalize_publisher_type(request.GET.get('publisher_type') or '')
        if publisher_type:
            qs = qs.filter(publisher_type=publisher_type)

        q = (request.GET.get('q') or '').strip()
        if q:
            qs = qs.filter(
                Q(pet_name__icontains=q)
                | Q(breed__icontains=q)
                | Q(description__icontains=q)
                | Q(region__icontains=q)
                | Q(comuna__icontains=q)
                | Q(shelter_name__icontains=q)
            )

        data = [_listing_to_dict(listing, include_image=include_image) for listing in qs[:200]]
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
        breed = (body.get('breed') or '').strip()
        age_label = (body.get('age_label') or '').strip()
        sex = (body.get('sex') or '').strip()
        size = (body.get('size') or '').strip()
        description = (body.get('description') or '').strip()
        image_data_url = (body.get('image_data_url') or '').strip()
        raw_images = body.get('imagenes')
        color = (body.get('color') or '').strip()
        is_sterilized = _parse_bool(body.get('is_sterilized'))
        vaccines_up_to_date = _parse_bool(body.get('vaccines_up_to_date'))
        has_microchip = _parse_bool(body.get('has_microchip'))
        adoption_reason = (body.get('adoption_reason') or '').strip()
        behavior_notes = (body.get('behavior_notes') or '').strip()
        region = (body.get('region') or '').strip()
        comuna = (body.get('comuna') or '').strip()
        publisher_type = _normalize_publisher_type(body.get('publisher_type') or 'persona') or 'persona'
        shelter_name = (body.get('shelter_name') or '').strip()
        health_notes = (body.get('health_notes') or '').strip()
        contact_name = (body.get('contact_name') or '').strip()
        contact_phone = (body.get('contact_phone') or '').strip()
        contact_email = (body.get('contact_email') or '').strip()
        latitude_raw = body.get('latitude', None)
        longitude_raw = body.get('longitude', None)

        if not pet_name:
            return JsonResponse({'detail': 'pet_name_required'}, status=400)
        if not species or not region or not comuna:
            return JsonResponse({'detail': 'species_region_comuna_required'}, status=400)
        if not description:
            return JsonResponse({'detail': 'description_required'}, status=400)
        if not adoption_reason:
            return JsonResponse({'detail': 'adoption_reason_required'}, status=400)
        if is_sterilized is None or vaccines_up_to_date is None or has_microchip is None:
            return JsonResponse({'detail': 'health_fields_required'}, status=400)
        if not contact_name:
            return JsonResponse({'detail': 'contact_name_required'}, status=400)
        if publisher_type not in {'persona', 'albergue'}:
            return JsonResponse({'detail': 'invalid_publisher_type'}, status=400)

        try:
            images = _normalize_images(raw_images)
        except ValueError:
            return JsonResponse({'detail': 'invalid_images'}, status=400)

        if image_data_url:
            if not image_data_url.startswith('data:image/'):
                return JsonResponse({'detail': 'invalid_image'}, status=400)
            if len(image_data_url) > 1_500_000:
                return JsonResponse({'detail': 'image_too_large'}, status=400)

        contact_error = _validate_contact_fields(contact_phone, contact_email)
        if contact_error:
            return contact_error

        latitude, longitude, coord_error = _parse_coordinates(latitude_raw, longitude_raw)
        if coord_error:
            return coord_error

        listing = AdoptionListing.objects.create(
            pet_name=pet_name,
            species=species,
            breed=breed,
            age_label=age_label,
            sex=sex,
            size=size,
            description=description,
            image_data_url=image_data_url,
            imagenes=images,
            color=color,
            is_sterilized=is_sterilized,
            vaccines_up_to_date=vaccines_up_to_date,
            has_microchip=has_microchip,
            adoption_reason=adoption_reason,
            behavior_notes=behavior_notes,
            region=region,
            comuna=comuna,
            latitude=latitude,
            longitude=longitude,
            publisher_type=publisher_type,
            shelter_name=shelter_name,
            health_notes=health_notes,
            contact_name=contact_name,
            contact_phone=contact_phone,
            contact_email=contact_email,
            publisher_id=int(payload.get('sub')),
            is_confirmed=False,
            confirmed_at=None,
            confirmed_by='',
        )
        return JsonResponse(_listing_to_dict(listing, include_image=False), status=201)

    return HttpResponseNotAllowed(['GET', 'POST'])


@csrf_exempt
def adoption_detail(request, listing_id: int):
    try:
        listing = AdoptionListing.objects.get(id=listing_id)
    except AdoptionListing.DoesNotExist:
        return JsonResponse({'detail': 'not_found'}, status=404)

    if request.method == 'GET':
        if listing.is_confirmed:
            return JsonResponse(_listing_to_dict(listing, include_image=True), status=200)
        payload = _get_access_payload(request)
        if payload is not None:
            try:
                is_owner = int(payload.get('sub')) == listing.publisher_id
            except (TypeError, ValueError):
                is_owner = False
            if _is_admin(payload) or is_owner:
                return JsonResponse(_listing_to_dict(listing, include_image=True), status=200)
        return JsonResponse({'detail': 'not_found'}, status=404)

    payload = _get_access_payload(request)
    if payload is None:
        return JsonResponse({'detail': 'unauthorized'}, status=401)

    try:
        is_owner = int(payload.get('sub')) == listing.publisher_id
    except (TypeError, ValueError):
        is_owner = False
    is_admin = _is_admin(payload)

    if request.method in {'PATCH', 'PUT'}:
        if not (is_admin or is_owner):
            return JsonResponse({'detail': 'forbidden'}, status=403)

        try:
            body = _read_json(request)
        except json.JSONDecodeError:
            return JsonResponse({'detail': 'invalid_json'}, status=400)

        had_changes = False
        text_fields = [
            'pet_name',
            'species',
            'breed',
            'age_label',
            'sex',
            'size',
            'description',
            'image_data_url',
            'color',
            'adoption_reason',
            'behavior_notes',
            'region',
            'comuna',
            'shelter_name',
            'health_notes',
            'contact_name',
            'contact_phone',
            'contact_email',
        ]
        for field in text_fields:
            if field in body:
                value = (body.get(field) or '').strip()
                if field == 'pet_name' and not value:
                    return JsonResponse({'detail': 'pet_name_required'}, status=400)
                if field == 'contact_name' and not value:
                    return JsonResponse({'detail': 'contact_name_required'}, status=400)
                if field == 'image_data_url' and value:
                    if not value.startswith('data:image/'):
                        return JsonResponse({'detail': 'invalid_image'}, status=400)
                    if len(value) > 1_500_000:
                        return JsonResponse({'detail': 'image_too_large'}, status=400)
                if getattr(listing, field) != value:
                    had_changes = True
                setattr(listing, field, value)

        bool_fields = ['is_sterilized', 'vaccines_up_to_date', 'has_microchip']
        for field in bool_fields:
            if field in body:
                parsed = _parse_bool(body.get(field))
                if parsed is None:
                    return JsonResponse({'detail': 'invalid_bool'}, status=400)
                if getattr(listing, field) != parsed:
                    had_changes = True
                setattr(listing, field, parsed)

        if 'imagenes' in body:
            try:
                next_images = _normalize_images(body.get('imagenes'))
            except ValueError:
                return JsonResponse({'detail': 'invalid_images'}, status=400)
            if listing.imagenes != next_images:
                had_changes = True
            listing.imagenes = next_images

        if 'publisher_type' in body:
            next_publisher_type = _normalize_publisher_type(body.get('publisher_type') or '')
            if next_publisher_type not in {'persona', 'albergue'}:
                return JsonResponse({'detail': 'invalid_publisher_type'}, status=400)
            if listing.publisher_type != next_publisher_type:
                had_changes = True
            listing.publisher_type = next_publisher_type

        if 'latitude' in body or 'longitude' in body:
            latitude_raw = body.get('latitude', None)
            longitude_raw = body.get('longitude', None)
            if latitude_raw in (None, '') and longitude_raw in (None, ''):
                if listing.latitude is not None or listing.longitude is not None:
                    had_changes = True
                listing.latitude = None
                listing.longitude = None
            else:
                latitude, longitude, coord_error = _parse_coordinates(latitude_raw, longitude_raw)
                if coord_error:
                    return coord_error
                if listing.latitude != latitude or listing.longitude != longitude:
                    had_changes = True
                listing.latitude = latitude
                listing.longitude = longitude

        contact_error = _validate_contact_fields(listing.contact_phone, listing.contact_email)
        if contact_error:
            return contact_error

        if had_changes:
            listing.is_confirmed = False
            listing.confirmed_at = None
            listing.confirmed_by = ''

        if 'is_confirmed' in body:
            if not is_admin:
                return JsonResponse({'detail': 'forbidden'}, status=403)
            desired = bool(body.get('is_confirmed'))
            if desired:
                listing.is_confirmed = True
                listing.confirmed_at = timezone.now()
                listing.confirmed_by = (payload.get('username') or '').strip()
            else:
                listing.is_confirmed = False
                listing.confirmed_at = None
                listing.confirmed_by = ''

        listing.save()
        return JsonResponse(_listing_to_dict(listing, include_image=True), status=200)

    if request.method == 'DELETE':
        if not (is_admin or is_owner):
            return JsonResponse({'detail': 'forbidden'}, status=403)
        listing.delete()
        return HttpResponse(status=204)

    return HttpResponseNotAllowed(['GET', 'PATCH', 'PUT', 'DELETE'])
