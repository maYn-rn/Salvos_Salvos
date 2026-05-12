import base64
import hashlib
import hmac
import json
import time

from django.conf import settings
from django.test import Client, TestCase
from django.utils import timezone

from .models import LostPetReport


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b'=').decode('ascii')


def _jwt_encode(payload: dict, secret: str) -> str:
    header = {'alg': 'HS256', 'typ': 'JWT'}
    header_b64 = _b64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
    signing_input = f'{header_b64}.{payload_b64}'.encode('ascii')
    sig = hmac.new(secret.encode('utf-8'), signing_input, hashlib.sha256).digest()
    sig_b64 = _b64url_encode(sig)
    return f'{header_b64}.{payload_b64}.{sig_b64}'


def make_access_token(user_id: int, username: str = 'u', is_staff: bool = False, is_superuser: bool = False) -> str:
    now = int(time.time())
    payload = {
        'typ': 'access',
        'sub': int(user_id),
        'username': username,
        'is_staff': bool(is_staff),
        'is_superuser': bool(is_superuser),
        'iat': now,
        'exp': now + 3600,
    }
    return _jwt_encode(payload, settings.JWT_SECRET)


def auth_headers(token: str) -> dict:
    return {'HTTP_AUTHORIZATION': f'Bearer {token}'}


class ReportsVisibilityTests(TestCase):
    def setUp(self):
        self.client = Client()

        self.confirmed = LostPetReport.objects.create(
            pet_name='Firulais',
            species='Perro',
            description='d',
            image_data_url='data:image/png;base64,AAAA',
            region='Región Metropolitana de Santiago',
            comuna='Santiago',
            latitude=-33.45,
            longitude=-70.66,
            status='perdido',
            reporter_id=1,
            is_confirmed=True,
            confirmed_at=timezone.now(),
            confirmed_by='admin',
        )

        self.unconfirmed = LostPetReport.objects.create(
            pet_name='Michi',
            species='Gato',
            description='d2',
            image_data_url='data:image/png;base64,BBBB',
            region='Región Metropolitana de Santiago',
            comuna='Providencia',
            latitude=-33.43,
            longitude=-70.61,
            status='perdido',
            reporter_id=2,
            is_confirmed=False,
            confirmed_at=None,
            confirmed_by='',
        )

    def test_list_only_confirmed_by_default(self):
        resp = self.client.get('/api/reports')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        ids = [r['id'] for r in data['results']]
        self.assertIn(self.confirmed.id, ids)
        self.assertNotIn(self.unconfirmed.id, ids)

    def test_list_include_unconfirmed_requires_admin(self):
        token = make_access_token(10, is_staff=False)
        resp = self.client.get('/api/reports?include_unconfirmed=1', **auth_headers(token))
        self.assertEqual(resp.status_code, 200)
        ids = [r['id'] for r in resp.json()['results']]
        self.assertIn(self.confirmed.id, ids)
        self.assertNotIn(self.unconfirmed.id, ids)

        admin_token = make_access_token(99, username='admin', is_staff=True)
        resp2 = self.client.get('/api/reports?include_unconfirmed=1', **auth_headers(admin_token))
        self.assertEqual(resp2.status_code, 200)
        ids2 = [r['id'] for r in resp2.json()['results']]
        self.assertIn(self.confirmed.id, ids2)
        self.assertIn(self.unconfirmed.id, ids2)

    def test_detail_requires_confirmed_or_owner_or_admin(self):
        resp = self.client.get(f'/api/reports/{self.unconfirmed.id}')
        self.assertEqual(resp.status_code, 404)

        owner_token = make_access_token(self.unconfirmed.reporter_id, username='owner', is_staff=False)
        resp2 = self.client.get(f'/api/reports/{self.unconfirmed.id}', **auth_headers(owner_token))
        self.assertEqual(resp2.status_code, 200)
        self.assertIn('image_data_url', resp2.json())

        admin_token = make_access_token(99, username='admin', is_superuser=True)
        resp3 = self.client.get(f'/api/reports/{self.unconfirmed.id}', **auth_headers(admin_token))
        self.assertEqual(resp3.status_code, 200)
        self.assertIn('image_data_url', resp3.json())


class ReportsCreateAndEditTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user_token = make_access_token(1, username='user1')
        self.other_token = make_access_token(2, username='user2')
        self.admin_token = make_access_token(99, username='admin', is_staff=True)

    def test_create_requires_auth(self):
        resp = self.client.post('/api/reports', data=json.dumps({}), content_type='application/json')
        self.assertEqual(resp.status_code, 401)

    def test_create_validations(self):
        base = {
            'pet_name': 'A',
            'species': 'Perro',
            'image_data_url': 'data:image/png;base64,AAAA',
            'region': 'Región Metropolitana de Santiago',
            'comuna': 'Santiago',
            'latitude': -33.45,
            'longitude': -70.66,
        }

        body = dict(base)
        body['pet_name'] = ''
        resp = self.client.post('/api/reports', data=json.dumps(body), content_type='application/json', **auth_headers(self.user_token))
        self.assertEqual(resp.status_code, 400)

        body = dict(base)
        body['image_data_url'] = ''
        resp = self.client.post('/api/reports', data=json.dumps(body), content_type='application/json', **auth_headers(self.user_token))
        self.assertEqual(resp.status_code, 400)

        body = dict(base)
        body['image_data_url'] = 'http://example.com/x.png'
        resp = self.client.post('/api/reports', data=json.dumps(body), content_type='application/json', **auth_headers(self.user_token))
        self.assertEqual(resp.status_code, 400)

        body = dict(base)
        body['latitude'] = -33.4
        body['longitude'] = None
        resp = self.client.post('/api/reports', data=json.dumps(body), content_type='application/json', **auth_headers(self.user_token))
        self.assertEqual(resp.status_code, 400)

    def test_create_defaults_status_and_unconfirmed(self):
        body = {
            'pet_name': 'Firulais',
            'species': 'Perro',
            'description': 'd',
            'image_data_url': 'data:image/png;base64,AAAA',
            'region': 'Región Metropolitana de Santiago',
            'comuna': 'Santiago',
            'latitude': -33.45,
            'longitude': -70.66,
        }
        resp = self.client.post('/api/reports', data=json.dumps(body), content_type='application/json', **auth_headers(self.user_token))
        self.assertEqual(resp.status_code, 201)
        report_id = resp.json()['id']
        r = LostPetReport.objects.get(id=report_id)
        self.assertEqual(r.status, 'perdido')
        self.assertFalse(r.is_confirmed)

    def test_owner_edit_unconfirms_and_normalizes_status(self):
        r = LostPetReport.objects.create(
            pet_name='X',
            species='Perro',
            description='d',
            image_data_url='data:image/png;base64,AAAA',
            region='Región Metropolitana de Santiago',
            comuna='Santiago',
            latitude=-33.45,
            longitude=-70.66,
            status='perdido',
            reporter_id=1,
            is_confirmed=True,
            confirmed_at=timezone.now(),
            confirmed_by='admin',
        )

        resp = self.client.patch(
            f'/api/reports/{r.id}',
            data=json.dumps({'status': 'lost', 'description': 'nuevo'}),
            content_type='application/json',
            **auth_headers(self.user_token),
        )
        self.assertEqual(resp.status_code, 200)
        r.refresh_from_db()
        self.assertEqual(r.status, 'perdido')
        self.assertFalse(r.is_confirmed)
        self.assertIsNone(r.confirmed_at)
        self.assertEqual(r.confirmed_by, '')

    def test_owner_cannot_confirm(self):
        r = LostPetReport.objects.create(
            pet_name='X',
            species='Perro',
            description='d',
            image_data_url='data:image/png;base64,AAAA',
            region='Región Metropolitana de Santiago',
            comuna='Santiago',
            latitude=-33.45,
            longitude=-70.66,
            status='perdido',
            reporter_id=1,
            is_confirmed=False,
        )
        resp = self.client.patch(
            f'/api/reports/{r.id}',
            data=json.dumps({'is_confirmed': True}),
            content_type='application/json',
            **auth_headers(self.user_token),
        )
        self.assertEqual(resp.status_code, 403)

    def test_admin_can_confirm(self):
        r = LostPetReport.objects.create(
            pet_name='X',
            species='Perro',
            description='d',
            image_data_url='data:image/png;base64,AAAA',
            region='Región Metropolitana de Santiago',
            comuna='Santiago',
            latitude=-33.45,
            longitude=-70.66,
            status='perdido',
            reporter_id=1,
            is_confirmed=False,
        )
        resp = self.client.patch(
            f'/api/reports/{r.id}',
            data=json.dumps({'is_confirmed': True}),
            content_type='application/json',
            **auth_headers(self.admin_token),
        )
        self.assertEqual(resp.status_code, 200)
        r.refresh_from_db()
        self.assertTrue(r.is_confirmed)
        self.assertIsNotNone(r.confirmed_at)
        self.assertEqual(r.confirmed_by, 'admin')

    def test_delete_permissions(self):
        r = LostPetReport.objects.create(
            pet_name='X',
            species='Perro',
            description='d',
            image_data_url='data:image/png;base64,AAAA',
            region='Región Metropolitana de Santiago',
            comuna='Santiago',
            latitude=-33.45,
            longitude=-70.66,
            status='perdido',
            reporter_id=1,
            is_confirmed=False,
        )
        resp = self.client.delete(f'/api/reports/{r.id}', **auth_headers(self.other_token))
        self.assertEqual(resp.status_code, 403)

        resp2 = self.client.delete(f'/api/reports/{r.id}', **auth_headers(self.user_token))
        self.assertEqual(resp2.status_code, 204)
        self.assertFalse(LostPetReport.objects.filter(id=r.id).exists())
