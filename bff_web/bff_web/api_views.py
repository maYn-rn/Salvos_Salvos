import json
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from django.http import HttpResponse, HttpResponseNotAllowed, JsonResponse
from django.views.decorators.csrf import csrf_exempt


def _build_url(base_url: str, request) -> str:
    path = request.path
    if request.META.get('QUERY_STRING'):
        return f'{base_url}{path}?{request.META["QUERY_STRING"]}'
    return f'{base_url}{path}'


def _forward(request, base_url: str):
    url = _build_url(base_url, request)
    data = request.body if request.method in {'POST', 'PUT', 'PATCH'} else None
    headers = {}

    content_type = request.headers.get('Content-Type')
    if content_type:
        headers['Content-Type'] = content_type

    auth = request.headers.get('Authorization')
    if auth:
        headers['Authorization'] = auth

    req = urllib.request.Request(url, data=data, headers=headers, method=request.method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = resp.read()
            resp_status = resp.status
            resp_ct = resp.headers.get('Content-Type', '')
    except urllib.error.HTTPError as e:
        resp_body = e.read() if e.fp else b''
        resp_status = e.code
        resp_ct = e.headers.get('Content-Type', '') if e.headers else ''
    except urllib.error.URLError:
        return JsonResponse({'detail': 'upstream_unavailable'}, status=502)

    if resp_status == 204:
        return HttpResponse(status=204)

    if 'application/json' in resp_ct:
        try:
            payload = json.loads(resp_body.decode('utf-8') or 'null')
        except json.JSONDecodeError:
            return JsonResponse({'detail': 'invalid_upstream_json'}, status=502)
        if isinstance(payload, dict):
            return JsonResponse(payload, status=resp_status)
        return JsonResponse(payload, safe=False, status=resp_status)

    return HttpResponse(resp_body, status=resp_status, content_type=resp_ct or 'application/octet-stream')


def _set_refresh_cookie(response, refresh_token: str):
    cookie_secure = str(getattr(settings, 'REFRESH_COOKIE_SECURE', '') or '').strip().lower() in {'1', 'true', 'yes', 'si', 'sí'}
    cookie_samesite = str(getattr(settings, 'REFRESH_COOKIE_SAMESITE', '') or '').strip().lower()
    if cookie_samesite in {'none', 'lax', 'strict'}:
        cookie_samesite = cookie_samesite.capitalize() if cookie_samesite != 'none' else 'None'
    else:
        cookie_samesite = 'Lax'

    response.set_cookie(
        'refresh_token',
        refresh_token,
        httponly=True,
        samesite=cookie_samesite,
        secure=bool(cookie_secure),
        path='/api/auth',
        max_age=int(getattr(settings, 'JWT_REFRESH_TTL_SECONDS', 604800)),
    )


def _clear_refresh_cookie(response):
    response.delete_cookie('refresh_token', path='/api/auth')


@csrf_exempt
def auth_register(request):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])

    resp = _forward(request, settings.SECURITY_SERVICE_BASE_URL)
    if not isinstance(resp, JsonResponse) or resp.status_code not in (200, 201):
        return resp

    payload = json.loads(resp.content.decode('utf-8'))
    access = payload.get('access')
    refresh = payload.get('refresh')
    if not access or not refresh:
        return JsonResponse({'detail': 'invalid_upstream_payload'}, status=502)

    out = JsonResponse({'access': access}, status=resp.status_code)
    _set_refresh_cookie(out, refresh)
    return out


@csrf_exempt
def auth_login(request):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])

    resp = _forward(request, settings.SECURITY_SERVICE_BASE_URL)
    if not isinstance(resp, JsonResponse) or resp.status_code != 200:
        return resp

    payload = json.loads(resp.content.decode('utf-8'))
    access = payload.get('access')
    refresh = payload.get('refresh')
    if not access or not refresh:
        return JsonResponse({'detail': 'invalid_upstream_payload'}, status=502)

    out = JsonResponse({'access': access}, status=200)
    _set_refresh_cookie(out, refresh)
    return out


@csrf_exempt
def auth_refresh(request):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])

    refresh = request.COOKIES.get('refresh_token')
    if not refresh:
        return JsonResponse({'detail': 'missing_refresh_cookie'}, status=401)

    url = f'{settings.SECURITY_SERVICE_BASE_URL}/api/auth/refresh/'
    data = json.dumps({'refresh': refresh}, separators=(',', ':')).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = resp.read()
            resp_status = resp.status
    except urllib.error.HTTPError as e:
        resp_body = e.read() if e.fp else b''
        resp_status = e.code
    except urllib.error.URLError:
        return JsonResponse({'detail': 'upstream_unavailable'}, status=502)

    if resp_status != 200:
        out_err = HttpResponse(resp_body, status=resp_status, content_type='application/json')
        _clear_refresh_cookie(out_err)
        return out_err

    try:
        payload = json.loads(resp_body.decode('utf-8'))
    except json.JSONDecodeError:
        return JsonResponse({'detail': 'invalid_upstream_json'}, status=502)

    access = payload.get('access')
    new_refresh = payload.get('refresh')
    if not access or not new_refresh:
        return JsonResponse({'detail': 'invalid_upstream_payload'}, status=502)

    out = JsonResponse({'access': access}, status=200)
    _set_refresh_cookie(out, new_refresh)
    return out


@csrf_exempt
def auth_logout(request):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])

    refresh = request.COOKIES.get('refresh_token')
    if refresh:
        url = f'{settings.SECURITY_SERVICE_BASE_URL}/api/auth/logout/'
        data = json.dumps({'refresh': refresh}, separators=(',', ':')).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
        try:
            urllib.request.urlopen(req, timeout=10).read()
        except Exception:
            pass

    out = HttpResponse(status=204)
    _clear_refresh_cookie(out)
    return out


def auth_me(request):
    if request.method != 'GET':
        return HttpResponseNotAllowed(['GET'])
    return _forward(request, settings.SECURITY_SERVICE_BASE_URL)

def auth_users(request):
    if request.method not in {'GET', 'POST'}:
        return HttpResponseNotAllowed(['GET', 'POST'])
    return _forward(request, settings.SECURITY_SERVICE_BASE_URL)


@csrf_exempt
def auth_user_detail(request, user_id: int):
    if request.method not in {'PATCH', 'OPTIONS'}:
        return HttpResponseNotAllowed(['PATCH', 'OPTIONS'])
    return _forward(request, settings.SECURITY_SERVICE_BASE_URL)


def auth_veterinarias(request):
    if request.method != 'GET':
        return HttpResponseNotAllowed(['GET'])
    return _forward(request, settings.SECURITY_SERVICE_BASE_URL)


@csrf_exempt
def auth_veterinaria_detail(request, veterinaria_id: int):
    if request.method not in {'GET', 'PATCH', 'OPTIONS'}:
        return HttpResponseNotAllowed(['GET', 'PATCH', 'OPTIONS'])
    return _forward(request, settings.SECURITY_SERVICE_BASE_URL)


@csrf_exempt
def faqs_proxy(request):
    if request.method not in {'GET', 'POST', 'OPTIONS'}:
        return HttpResponseNotAllowed(['GET', 'POST', 'OPTIONS'])
    return _forward(request, settings.SECURITY_SERVICE_BASE_URL)


@csrf_exempt
def faq_detail_proxy(request, faq_id: int):
    if request.method not in {'PATCH', 'OPTIONS'}:
        return HttpResponseNotAllowed(['PATCH', 'OPTIONS'])
    return _forward(request, settings.SECURITY_SERVICE_BASE_URL)


@csrf_exempt
def reports_proxy(request):
    if request.method not in {'GET', 'POST', 'OPTIONS'}:
        return HttpResponseNotAllowed(['GET', 'POST', 'OPTIONS'])
    # Solo pasamos la base, _forward se encarga del path original
    return _forward(request, settings.MASCOTAS_SERVICE_BASE_URL)


@csrf_exempt
def adoptions_proxy(request):
    if request.method not in {'GET', 'POST', 'OPTIONS'}:
        return HttpResponseNotAllowed(['GET', 'POST', 'OPTIONS'])
    return _forward(request, settings.ADOPTIONS_SERVICE_BASE_URL)


@csrf_exempt
def archivos_proxy(request):
    if request.method not in {'GET', 'POST', 'OPTIONS'}:
        return HttpResponseNotAllowed(['GET', 'POST', 'OPTIONS'])
    return _forward(request, settings.ARCHIVOS_SERVICE_BASE_URL)


@csrf_exempt
def report_detail_proxy(request, report_id: int):
    if request.method not in {'GET', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'}:
        return HttpResponseNotAllowed(['GET', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'])
    # Solo pasamos la base
    return _forward(request, settings.MASCOTAS_SERVICE_BASE_URL)


@csrf_exempt
def report_found_leads_proxy(request, report_id: int):
    if request.method not in {'POST', 'OPTIONS'}:
        return HttpResponseNotAllowed(['POST', 'OPTIONS'])
    return _forward(request, settings.MASCOTAS_SERVICE_BASE_URL)


@csrf_exempt
def report_found_lead_detail_proxy(request, lead_id: int):
    if request.method not in {'GET', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'}:
        return HttpResponseNotAllowed(['GET', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'])
    return _forward(request, settings.MASCOTAS_SERVICE_BASE_URL)


@csrf_exempt
def adoption_detail_proxy(request, adoption_id: int):
    if request.method not in {'GET', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'}:
        return HttpResponseNotAllowed(['GET', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'])
    return _forward(request, settings.ADOPTIONS_SERVICE_BASE_URL)


@csrf_exempt
def archivo_detalle_proxy(request, archivo_id: int):
    if request.method not in {'GET', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'}:
        return HttpResponseNotAllowed(['GET', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'])
    return _forward(request, settings.ARCHIVOS_SERVICE_BASE_URL)


@csrf_exempt
def archivo_descargar_proxy(request, archivo_id: int):
    if request.method not in {'GET', 'OPTIONS'}:
        return HttpResponseNotAllowed(['GET', 'OPTIONS'])
    return _forward(request, settings.ARCHIVOS_SERVICE_BASE_URL)
