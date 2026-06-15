import json
import io
import urllib.error

from django.http import JsonResponse
from django.test import Client, TestCase, override_settings
from unittest.mock import patch


class _RespuestaHTTPFalsa:
    def __init__(self, status: int, body: bytes, content_type: str = 'application/json'):
        self.status = status
        self._body = body
        self.headers = {'Content-Type': content_type}

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


@override_settings(SECURITY_SERVICE_BASE_URL='http://security', MASCOTAS_SERVICE_BASE_URL='http://mascotas')
class PruebasAutenticacionBff(TestCase):
    def setUp(self):
        self.client = Client()

    def test_login_guarda_cookie_refresh_y_retorna_solo_access(self):
        with patch('bff_web.api_views._forward') as fwd:
            fwd.return_value = JsonResponse({'access': 'acc', 'refresh': 'ref'}, status=200)
            resp = self.client.post('/api/auth/login/', data=json.dumps({'username': 'u', 'password': 'p'}), content_type='application/json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), {'access': 'acc'})
        self.assertIn('refresh_token', resp.cookies)
        self.assertEqual(resp.cookies['refresh_token'].value, 'ref')
        self.assertTrue(resp.cookies['refresh_token']['httponly'])

    def test_register_guarda_cookie_refresh_y_retorna_solo_access(self):
        with patch('bff_web.api_views._forward') as fwd:
            fwd.return_value = JsonResponse({'access': 'acc', 'refresh': 'ref'}, status=201)
            resp = self.client.post('/api/auth/register/', data=json.dumps({'username': 'u', 'password': 'p'}), content_type='application/json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json(), {'access': 'acc'})
        self.assertIn('refresh_token', resp.cookies)

    def test_refresh_requiere_cookie(self):
        resp = self.client.post('/api/auth/refresh/', data=b'{}', content_type='application/json')
        self.assertEqual(resp.status_code, 401)

    def test_refresh_rota_cookie(self):
        self.client.cookies['refresh_token'] = 'old'
        with patch('urllib.request.urlopen') as urlopen:
            urlopen.return_value = _RespuestaHTTPFalsa(200, b'{"access":"newacc","refresh":"newref"}')
            resp = self.client.post('/api/auth/refresh/', data=b'{}', content_type='application/json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), {'access': 'newacc'})
        self.assertIn('refresh_token', resp.cookies)
        self.assertEqual(resp.cookies['refresh_token'].value, 'newref')

    def test_refresh_limpia_cookie_si_hay_error_en_servicio(self):
        self.client.cookies['refresh_token'] = 'old'
        err = urllib.error.HTTPError(
            url='http://security/api/auth/refresh',
            code=401,
            msg='Unauthorized',
            hdrs={'Content-Type': 'application/json'},
            fp=io.BytesIO(b'{"detail":"invalid_refresh"}'),
        )
        with patch('urllib.request.urlopen', side_effect=err):
            resp = self.client.post('/api/auth/refresh/', data=b'{}', content_type='application/json')
        self.assertEqual(resp.status_code, 401)
        self.assertIn('refresh_token', resp.cookies)
        self.assertEqual(resp.cookies['refresh_token'].value, '')


@override_settings(SECURITY_SERVICE_BASE_URL='http://security', MASCOTAS_SERVICE_BASE_URL='http://mascotas')
class PruebasProxyBff(TestCase):
    def setUp(self):
        self.client = Client()

    def test_reports_proxy_llama_forward_hacia_mascotas(self):
        with patch('bff_web.api_views._forward') as fwd:
            fwd.return_value = JsonResponse({'results': []}, status=200)
            resp = self.client.get('/api/reports/')
        self.assertEqual(resp.status_code, 200)
        args, kwargs = fwd.call_args
        self.assertEqual(args[1], 'http://mascotas')

    def test_auth_me_llama_forward_hacia_seguridad(self):
        with patch('bff_web.api_views._forward') as fwd:
            fwd.return_value = JsonResponse({'id': 1}, status=200)
            resp = self.client.get('/api/auth/me/')
        self.assertEqual(resp.status_code, 200)
        args, kwargs = fwd.call_args
        self.assertEqual(args[1], 'http://security')
