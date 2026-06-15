import base64
import hashlib
import hmac
import json
import time

from django.conf import settings
from django.test import Client, TestCase

from .models import AdoptionListing


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


def crear_token_acceso(usuario_id: int, username: str = 'u', es_admin: bool = False) -> str:
    ahora = int(time.time())
    payload = {
        'typ': 'access',
        'sub': int(usuario_id),
        'username': username,
        'is_staff': bool(es_admin),
        'is_superuser': bool(es_admin),
        'iat': ahora,
        'exp': ahora + 3600,
    }
    return _codificar_jwt(payload, settings.JWT_SECRET)


def encabezados_autorizacion(token: str) -> dict:
    return {'HTTP_AUTHORIZATION': f'Bearer {token}'}


class PruebasListadoAdopciones(TestCase):
    def setUp(self):
        self.client = Client()
        self.token_dueno = crear_token_acceso(1, username='dueno')
        self.token_admin = crear_token_acceso(99, username='admin', es_admin=True)

        self.confirmada = AdoptionListing.objects.create(
            pet_name='Luna',
            species='Perro',
            breed='',
            age_label='2 años',
            sex='Hembra',
            size='Mediano',
            description='d',
            image_data_url='',
            imagenes=[],
            color='',
            is_sterilized=True,
            vaccines_up_to_date=True,
            has_microchip=False,
            adoption_reason='Cambio de casa',
            behavior_notes='',
            region='Región Metropolitana de Santiago',
            comuna='Santiago',
            latitude=None,
            longitude=None,
            publisher_type='persona',
            shelter_name='',
            health_notes='',
            contact_name='Matias',
            contact_phone='+56911111111',
            contact_email='',
            publisher_id=1,
            is_confirmed=True,
            confirmed_at=None,
            confirmed_by='admin',
        )
        self.no_confirmada = AdoptionListing.objects.create(
            pet_name='Michi',
            species='Gato',
            breed='',
            age_label='1 año',
            sex='Macho',
            size='Pequeño',
            description='d',
            image_data_url='',
            imagenes=[],
            color='',
            is_sterilized=True,
            vaccines_up_to_date=True,
            has_microchip=False,
            adoption_reason='Rescate',
            behavior_notes='',
            region='Región Metropolitana de Santiago',
            comuna='Providencia',
            latitude=None,
            longitude=None,
            publisher_type='persona',
            shelter_name='',
            health_notes='',
            contact_name='Matias',
            contact_phone='+56911111111',
            contact_email='',
            publisher_id=1,
            is_confirmed=False,
            confirmed_at=None,
            confirmed_by='',
        )

    def test_listado_solo_confirmadas_por_defecto(self):
        resp = self.client.get('/api/adoptions/')
        self.assertEqual(resp.status_code, 200)
        ids = [item['id'] for item in resp.json().get('results') or []]
        self.assertIn(self.confirmada.id, ids)
        self.assertNotIn(self.no_confirmada.id, ids)

    def test_listado_include_mine_muestra_mias_no_confirmadas(self):
        resp = self.client.get('/api/adoptions/?include_mine=1', **encabezados_autorizacion(self.token_dueno))
        self.assertEqual(resp.status_code, 200)
        ids = [item['id'] for item in resp.json().get('results') or []]
        self.assertIn(self.confirmada.id, ids)
        self.assertIn(self.no_confirmada.id, ids)

    def test_listado_include_unconfirmed_requiere_admin(self):
        resp = self.client.get('/api/adoptions/?include_unconfirmed=1', **encabezados_autorizacion(self.token_dueno))
        self.assertEqual(resp.status_code, 200)
        ids = [item['id'] for item in resp.json().get('results') or []]
        self.assertIn(self.confirmada.id, ids)
        self.assertNotIn(self.no_confirmada.id, ids)

        resp2 = self.client.get('/api/adoptions/?include_unconfirmed=1', **encabezados_autorizacion(self.token_admin))
        self.assertEqual(resp2.status_code, 200)
        ids2 = [item['id'] for item in resp2.json().get('results') or []]
        self.assertIn(self.confirmada.id, ids2)
        self.assertIn(self.no_confirmada.id, ids2)


class PruebasCrearDetalleYEditarAdopciones(TestCase):
    def setUp(self):
        self.client = Client()
        self.token_dueno = crear_token_acceso(1, username='dueno')
        self.token_otro = crear_token_acceso(2, username='otro')
        self.token_admin = crear_token_acceso(99, username='admin', es_admin=True)

    def test_crear_requiere_auth(self):
        resp = self.client.post('/api/adoptions/', data=json.dumps({}), content_type='application/json')
        self.assertEqual(resp.status_code, 401)

    def test_crear_validaciones_principales(self):
        base = {
            'pet_name': 'Luna',
            'species': 'Perro',
            'description': 'd',
            'adoption_reason': 'x',
            'region': 'Región Metropolitana de Santiago',
            'comuna': 'Santiago',
            'publisher_type': 'persona',
            'contact_name': 'Matias',
            'contact_phone': '+56911111111',
            'is_sterilized': True,
            'vaccines_up_to_date': True,
            'has_microchip': False,
        }

        cuerpo = dict(base)
        cuerpo['pet_name'] = ''
        resp = self.client.post('/api/adoptions/', data=json.dumps(cuerpo), content_type='application/json', **encabezados_autorizacion(self.token_dueno))
        self.assertEqual(resp.status_code, 400)

        cuerpo = dict(base)
        cuerpo['is_sterilized'] = None
        resp = self.client.post('/api/adoptions/', data=json.dumps(cuerpo), content_type='application/json', **encabezados_autorizacion(self.token_dueno))
        self.assertEqual(resp.status_code, 400)

        cuerpo = dict(base)
        cuerpo['contact_phone'] = 'xxxx'
        resp = self.client.post('/api/adoptions/', data=json.dumps(cuerpo), content_type='application/json', **encabezados_autorizacion(self.token_dueno))
        self.assertEqual(resp.status_code, 400)

    def test_crear_detalle_y_confirmacion_admin(self):
        cuerpo = {
            'pet_name': 'Luna',
            'species': 'Perro',
            'breed': '',
            'age_label': '2 años',
            'sex': 'Hembra',
            'size': 'Mediano',
            'description': 'd',
            'imagenes': [{'id': 1, 'url_descarga': 'http://localhost/api/archivos/1/descargar/', 'categoria': 'principal', 'orden': 1}],
            'color': '',
            'is_sterilized': True,
            'vaccines_up_to_date': True,
            'has_microchip': False,
            'adoption_reason': 'Cambio de casa',
            'behavior_notes': '',
            'region': 'Región Metropolitana de Santiago',
            'comuna': 'Santiago',
            'publisher_type': 'persona',
            'contact_name': 'Matias',
            'contact_phone': '+56911111111',
            'contact_email': '',
        }
        resp = self.client.post('/api/adoptions/', data=json.dumps(cuerpo), content_type='application/json', **encabezados_autorizacion(self.token_dueno))
        self.assertEqual(resp.status_code, 201)
        listing_id = resp.json()['id']

        resp_publico = self.client.get(f'/api/adoptions/{listing_id}/')
        self.assertEqual(resp_publico.status_code, 404)

        resp_owner = self.client.get(f'/api/adoptions/{listing_id}/', **encabezados_autorizacion(self.token_dueno))
        self.assertEqual(resp_owner.status_code, 200)
        self.assertIn('imagenes', resp_owner.json())

        resp_confirm = self.client.patch(
            f'/api/adoptions/{listing_id}/',
            data=json.dumps({'is_confirmed': True}),
            content_type='application/json',
            **encabezados_autorizacion(self.token_admin),
        )
        self.assertEqual(resp_confirm.status_code, 200)
        self.assertTrue(resp_confirm.json()['is_confirmed'])

        resp_publico2 = self.client.get(f'/api/adoptions/{listing_id}/')
        self.assertEqual(resp_publico2.status_code, 200)

    def test_edicion_permisos(self):
        listing = AdoptionListing.objects.create(
            pet_name='Luna',
            species='Perro',
            breed='',
            age_label='2 años',
            sex='Hembra',
            size='Mediano',
            description='d',
            image_data_url='',
            imagenes=[],
            color='',
            is_sterilized=True,
            vaccines_up_to_date=True,
            has_microchip=False,
            adoption_reason='Cambio de casa',
            behavior_notes='',
            region='Región Metropolitana de Santiago',
            comuna='Santiago',
            latitude=None,
            longitude=None,
            publisher_type='persona',
            shelter_name='',
            health_notes='',
            contact_name='Matias',
            contact_phone='+56911111111',
            contact_email='',
            publisher_id=1,
            is_confirmed=True,
            confirmed_at=None,
            confirmed_by='admin',
        )

        resp = self.client.patch(
            f'/api/adoptions/{listing.id}/',
            data=json.dumps({'description': 'x'}),
            content_type='application/json',
            **encabezados_autorizacion(self.token_otro),
        )
        self.assertEqual(resp.status_code, 403)

        resp2 = self.client.patch(
            f'/api/adoptions/{listing.id}/',
            data=json.dumps({'description': 'nuevo'}),
            content_type='application/json',
            **encabezados_autorizacion(self.token_dueno),
        )
        self.assertEqual(resp2.status_code, 200)
        listing.refresh_from_db()
        self.assertEqual(listing.description, 'nuevo')
        self.assertFalse(listing.is_confirmed)
