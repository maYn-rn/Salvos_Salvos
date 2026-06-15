import base64
import hashlib
import hmac
import json
import time

from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings

from .models import RefreshToken


def _b64url(texto: bytes) -> str:
    return base64.urlsafe_b64encode(texto).rstrip(b'=').decode('ascii')


def _crear_token_acceso(secreto: str, sub: int, username: str = 'usuario', es_admin: bool = False, exp_segundos: int = 3600):
    ahora = int(time.time())
    payload = {
        'typ': 'access',
        'sub': sub,
        'username': username,
        'is_staff': bool(es_admin),
        'is_superuser': bool(es_admin),
        'iat': ahora,
        'exp': ahora + int(exp_segundos),
    }
    encabezado = {'alg': 'HS256', 'typ': 'JWT'}
    h = _b64url(json.dumps(encabezado, separators=(',', ':')).encode('utf-8'))
    p = _b64url(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
    entrada = f'{h}.{p}'.encode('ascii')
    firma = hmac.new(secreto.encode('utf-8'), entrada, hashlib.sha256).digest()
    f = _b64url(firma)
    return f'{h}.{p}.{f}'


@override_settings(JWT_SECRET='secreto-pruebas', JWT_ACCESS_TTL_SECONDS=3600, JWT_REFRESH_TTL_SECONDS=7200)
class PruebasFlujosAutenticacion(TestCase):
    def setUp(self):
        self.client = Client()

    def test_register_requiere_campos(self):
        resp = self.client.post('/api/auth/register/', data=b'{', content_type='application/json')
        self.assertEqual(resp.status_code, 400)

        resp = self.client.post(
            '/api/auth/register/',
            data=json.dumps({'username': 'alice', 'password': 'pass1234'}),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 400)

        resp = self.client.post(
            '/api/auth/register/',
            data=json.dumps({'username': 'alice', 'password': 'pass1234', 'email': 'correo@ejemplo.com'}),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json().get('detail'), 'first_and_last_name_required')

    def test_registro_login_refresh_logout(self):
        resp = self.client.post(
            '/api/auth/register/',
            data=json.dumps(
                {
                    'username': 'alice',
                    'password': 'pass1234',
                    'email': 'correo@ejemplo.com',
                    'first_name': 'Alice',
                    'last_name': 'Test',
                }
            ),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 201)
        payload = resp.json()
        self.assertIn('access', payload)
        self.assertIn('refresh', payload)
        self.assertEqual(len(payload['access'].split('.')), 3)
        self.assertEqual(len(payload['refresh'].split('.')), 3)
        self.assertEqual(RefreshToken.objects.count(), 1)

        resp_login = self.client.post(
            '/api/auth/login/',
            data=json.dumps({'username': 'alice', 'password': 'pass1234'}),
            content_type='application/json',
        )
        self.assertEqual(resp_login.status_code, 200)
        payload2 = resp_login.json()
        self.assertIn('access', payload2)
        self.assertIn('refresh', payload2)
        self.assertEqual(RefreshToken.objects.count(), 2)

        resp_refresh = self.client.post(
            '/api/auth/refresh/',
            data=json.dumps({'refresh': payload2['refresh']}),
            content_type='application/json',
        )
        self.assertEqual(resp_refresh.status_code, 200)
        self.assertIn('access', resp_refresh.json())
        self.assertIn('refresh', resp_refresh.json())

        resp_logout = self.client.post(
            '/api/auth/logout/',
            data=json.dumps({'refresh': payload2['refresh']}),
            content_type='application/json',
        )
        self.assertEqual(resp_logout.status_code, 204)

    def test_login_con_credenciales_invalidas(self):
        User = get_user_model()
        User.objects.create_user(
            username='bob',
            password='pw',
            email='bob@ejemplo.com',
            first_name='Bob',
            last_name='User',
        )
        resp = self.client.post(
            '/api/auth/login/',
            data=json.dumps({'username': 'bob', 'password': 'wrong'}),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 401)

    def test_me_y_users(self):
        User = get_user_model()
        normal = User.objects.create_user(
            username='normal',
            password='Clave12345',
            email='normal@ejemplo.com',
            first_name='N',
            last_name='U',
        )
        token_normal = _crear_token_acceso('secreto-pruebas', normal.id, username='normal', es_admin=False)
        resp = self.client.get('/api/auth/me/', HTTP_AUTHORIZATION=f'Bearer {token_normal}')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['username'], 'normal')

        resp = self.client.get('/api/auth/users/', HTTP_AUTHORIZATION=f'Bearer {token_normal}')
        self.assertEqual(resp.status_code, 403)

        admin = User.objects.create_user(
            username='admin',
            password='Clave12345',
            email='admin@ejemplo.com',
            first_name='A',
            last_name='D',
            is_staff=True,
        )
        token_admin = _crear_token_acceso('secreto-pruebas', admin.id, username='admin', es_admin=True)
        resp = self.client.get('/api/auth/users/', HTTP_AUTHORIZATION=f'Bearer {token_admin}')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('results', resp.json())
