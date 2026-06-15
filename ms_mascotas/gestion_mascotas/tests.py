import base64
import hashlib
import hmac
import json
import time

from django.conf import settings
from django.test import Client, TestCase
from django.utils import timezone

from .models import LostPetReport


def _codificar_b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b'=').decode('ascii')


def _codificar_jwt(payload: dict, secreto: str) -> str:
    encabezado = {'alg': 'HS256', 'typ': 'JWT'}
    encabezado_b64 = _codificar_b64url(json.dumps(encabezado, separators=(',', ':')).encode('utf-8'))
    carga_b64 = _codificar_b64url(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
    entrada_firma = f'{encabezado_b64}.{carga_b64}'.encode('ascii')
    firma = hmac.new(secreto.encode('utf-8'), entrada_firma, hashlib.sha256).digest()
    firma_b64 = _codificar_b64url(firma)
    return f'{encabezado_b64}.{carga_b64}.{firma_b64}'


def crear_token_acceso(usuario_id: int, username: str = 'u', es_staff: bool = False, es_superuser: bool = False) -> str:
    ahora = int(time.time())
    payload = {
        'typ': 'access',
        'sub': int(usuario_id),
        'username': username,
        'is_staff': bool(es_staff),
        'is_superuser': bool(es_superuser),
        'iat': ahora,
        'exp': ahora + 3600,
    }
    return _codificar_jwt(payload, settings.JWT_SECRET)


def encabezados_autorizacion(token: str) -> dict:
    return {'HTTP_AUTHORIZATION': f'Bearer {token}'}


class PruebasVisibilidadReportes(TestCase):
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

    def test_listar_solo_confirmados_por_defecto(self):
        resp = self.client.get('/api/reports/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        ids = [r['id'] for r in data['results']]
        self.assertIn(self.confirmed.id, ids)
        self.assertNotIn(self.unconfirmed.id, ids)

    def test_listar_include_unconfirmed_requiere_admin(self):
        token_usuario = crear_token_acceso(10, es_staff=False)
        resp = self.client.get('/api/reports/?include_unconfirmed=1', **encabezados_autorizacion(token_usuario))
        self.assertEqual(resp.status_code, 200)
        ids = [r['id'] for r in resp.json()['results']]
        self.assertIn(self.confirmed.id, ids)
        self.assertNotIn(self.unconfirmed.id, ids)

        token_admin = crear_token_acceso(99, username='admin', es_staff=True)
        resp2 = self.client.get('/api/reports/?include_unconfirmed=1', **encabezados_autorizacion(token_admin))
        self.assertEqual(resp2.status_code, 200)
        ids2 = [r['id'] for r in resp2.json()['results']]
        self.assertIn(self.confirmed.id, ids2)
        self.assertIn(self.unconfirmed.id, ids2)

    def test_detalle_requiere_confirmado_o_dueno_o_admin(self):
        resp = self.client.get(f'/api/reports/{self.unconfirmed.id}/')
        self.assertEqual(resp.status_code, 404)

        token_dueno = crear_token_acceso(self.unconfirmed.reporter_id, username='owner', es_staff=False)
        resp2 = self.client.get(f'/api/reports/{self.unconfirmed.id}/', **encabezados_autorizacion(token_dueno))
        self.assertEqual(resp2.status_code, 200)
        self.assertIn('image_data_url', resp2.json())

        token_admin = crear_token_acceso(99, username='admin', es_superuser=True)
        resp3 = self.client.get(f'/api/reports/{self.unconfirmed.id}/', **encabezados_autorizacion(token_admin))
        self.assertEqual(resp3.status_code, 200)
        self.assertIn('image_data_url', resp3.json())


class PruebasCrearYEditarReportes(TestCase):
    def setUp(self):
        self.client = Client()
        self.token_usuario = crear_token_acceso(1, username='user1')
        self.token_otro = crear_token_acceso(2, username='user2')
        self.token_admin = crear_token_acceso(99, username='admin', es_staff=True)

    def test_crear_requiere_auth(self):
        resp = self.client.post('/api/reports/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(resp.status_code, 401)

    def test_crear_validaciones(self):
        base = {
            'pet_name': 'A',
            'species': 'Perro',
            'region': 'Región Metropolitana de Santiago',
            'comuna': 'Santiago',
            'latitude': -33.45,
            'longitude': -70.66,
        }

        body = dict(base)
        body['pet_name'] = ''
        resp = self.client.post('/api/reports/', data=json.dumps(body), content_type='application/json', **encabezados_autorizacion(self.token_usuario))
        self.assertEqual(resp.status_code, 400)

        body = dict(base)
        body['image_data_url'] = 'http://example.com/x.png'
        resp = self.client.post('/api/reports/', data=json.dumps(body), content_type='application/json', **encabezados_autorizacion(self.token_usuario))
        self.assertEqual(resp.status_code, 400)

        body = dict(base)
        body['latitude'] = -33.4
        body['longitude'] = None
        resp = self.client.post('/api/reports/', data=json.dumps(body), content_type='application/json', **encabezados_autorizacion(self.token_usuario))
        self.assertEqual(resp.status_code, 400)

    def test_crear_setea_estado_por_defecto_y_no_confirmado(self):
        body = {
            'pet_name': 'Firulais',
            'species': 'Perro',
            'description': 'd',
            'imagenes': [
                {'id': 1, 'url_descarga': 'http://localhost/api/archivos/1/descargar/', 'categoria': 'principal', 'orden': 1},
            ],
            'region': 'Región Metropolitana de Santiago',
            'comuna': 'Santiago',
            'latitude': -33.45,
            'longitude': -70.66,
        }
        resp = self.client.post('/api/reports/', data=json.dumps(body), content_type='application/json', **encabezados_autorizacion(self.token_usuario))
        self.assertEqual(resp.status_code, 201)
        report_id = resp.json()['id']
        r = LostPetReport.objects.get(id=report_id)
        self.assertEqual(r.status, 'perdido')
        self.assertFalse(r.is_confirmed)

    def test_edicion_dueno_desconfirma_y_normaliza_estado(self):
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
            f'/api/reports/{r.id}/',
            data=json.dumps({'status': 'lost', 'description': 'nuevo'}),
            content_type='application/json',
            **encabezados_autorizacion(self.token_usuario),
        )
        self.assertEqual(resp.status_code, 200)
        r.refresh_from_db()
        self.assertEqual(r.status, 'perdido')
        self.assertFalse(r.is_confirmed)
        self.assertIsNone(r.confirmed_at)
        self.assertEqual(r.confirmed_by, '')

    def test_dueno_no_puede_confirmar(self):
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
            f'/api/reports/{r.id}/',
            data=json.dumps({'is_confirmed': True}),
            content_type='application/json',
            **encabezados_autorizacion(self.token_usuario),
        )
        self.assertEqual(resp.status_code, 403)

    def test_admin_puede_confirmar(self):
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
            f'/api/reports/{r.id}/',
            data=json.dumps({'is_confirmed': True}),
            content_type='application/json',
            **encabezados_autorizacion(self.token_admin),
        )
        self.assertEqual(resp.status_code, 200)
        r.refresh_from_db()
        self.assertTrue(r.is_confirmed)
        self.assertIsNotNone(r.confirmed_at)
        self.assertEqual(r.confirmed_by, 'admin')

    def test_eliminar_permisos(self):
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
        resp = self.client.delete(f'/api/reports/{r.id}/', **encabezados_autorizacion(self.token_otro))
        self.assertEqual(resp.status_code, 403)

        resp2 = self.client.delete(f'/api/reports/{r.id}/', **encabezados_autorizacion(self.token_usuario))
        self.assertEqual(resp2.status_code, 204)
        self.assertFalse(LostPetReport.objects.filter(id=r.id).exists())


class PruebasAvisosEncontrado(TestCase):
    def setUp(self):
        self.client = Client()
        self.token_usuario = crear_token_acceso(1, username='user1')
        self.reporte = LostPetReport.objects.create(
            pet_name='X',
            species='Perro',
            description='d',
            image_data_url='',
            imagenes=[],
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

    def test_crear_aviso_encontre_con_imagenes(self):
        resp = self.client.post(
            f'/api/reports/{self.reporte.id}/found-leads/',
            data=json.dumps(
                {
                    'found_location': 'Santiago centro',
                    'imagenes': [{'id': 11, 'url_descarga': 'http://localhost/api/archivos/11/descargar/', 'categoria': 'principal', 'orden': 1}],
                }
            ),
            content_type='application/json',
            **encabezados_autorizacion(self.token_usuario),
        )
        self.assertEqual(resp.status_code, 201)
        self.assertIn('id', resp.json())
