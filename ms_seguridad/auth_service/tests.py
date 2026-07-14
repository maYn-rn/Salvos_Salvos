import base64
import hashlib
import hmac
import json
import time

from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings

from .models import RefreshToken, VeterinariaProfile, VeterinariaVerificationDocument


def _b64url(texto: bytes) -> str:
    return base64.urlsafe_b64encode(texto).rstrip(b'=').decode('ascii')


def _crear_token_acceso(
    secreto: str,
    sub: int,
    username: str = 'usuario',
    es_admin: bool = False,
    exp_segundos: int = 3600,
    role: str = 'usuario',
    can_confirm_reports: bool = False,
):
    ahora = int(time.time())
    payload = {
        'typ': 'access',
        'sub': sub,
        'username': username,
        'is_staff': bool(es_admin),
        'is_superuser': bool(es_admin),
        'role': role,
        'can_confirm_reports': bool(can_confirm_reports),
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

        resp_crear_admin = self.client.post(
            '/api/auth/users/',
            data=json.dumps(
                {
                    'username': 'nuevo-admin',
                    'password': 'Clave12345',
                    'email': 'nuevo-admin@ejemplo.com',
                    'first_name': 'Nuevo',
                    'last_name': 'Admin',
                }
            ),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {token_admin}',
        )
        self.assertEqual(resp_crear_admin.status_code, 201)
        self.assertTrue(resp_crear_admin.json()['is_staff'])
        self.assertTrue(resp_crear_admin.json()['is_superuser'])

        objetivo = User.objects.create_user(
            username='moderable',
            password='Clave12345',
            email='moderable@ejemplo.com',
            first_name='Mo',
            last_name='Derable',
        )
        resp_promover = self.client.patch(
            f'/api/auth/users/{objetivo.id}/',
            data=json.dumps({'is_staff': True}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {token_admin}',
        )
        self.assertEqual(resp_promover.status_code, 200)
        objetivo.refresh_from_db()
        self.assertTrue(objetivo.is_staff)
        self.assertTrue(objetivo.is_superuser)

        resp_auto_demote = self.client.patch(
            f'/api/auth/users/{admin.id}/',
            data=json.dumps({'is_staff': False}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {token_admin}',
        )
        self.assertEqual(resp_auto_demote.status_code, 400)

    def test_registro_veterinaria_y_endpoints_publicos(self):
        resp = self.client.post(
            '/api/auth/register/',
            data=json.dumps(
                {
                    'username': 'vet-centro',
                    'password': 'Clave12345',
                    'email': 'contacto@vetcentro.cl',
                    'first_name': 'Ana',
                    'last_name': 'Perez',
                    'account_type': 'veterinaria',
                    'nombre_veterinaria': 'Veterinaria Centro',
                    'telefono_veterinaria': '+56912345678',
                    'region': 'Región Metropolitana de Santiago',
                    'comuna': 'Santiago',
                    'direccion_veterinaria': 'Alameda 1234',
                    'descripcion_veterinaria': 'Urgencias, vacunas y peluquería.',
                    'sitio_web_veterinaria': 'vetcentro.cl',
                    'latitude': -33.4489,
                    'longitude': -70.6693,
                }
            ),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 201)
        payload = resp.json()
        self.assertIn('access', payload)

        resp_login = self.client.post(
            '/api/auth/login/',
            data=json.dumps({'username': 'vet-centro', 'password': 'Clave12345'}),
            content_type='application/json',
        )
        self.assertEqual(resp_login.status_code, 200)
        token = resp_login.json()['access']

        resp_me = self.client.get('/api/auth/me/', HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(resp_me.status_code, 200)
        data_me = resp_me.json()
        self.assertEqual(data_me['role'], 'veterinaria')
        self.assertFalse(data_me['can_confirm_reports'])
        self.assertEqual(data_me['veterinaria']['nombre_veterinaria'], 'Veterinaria Centro')
        self.assertEqual(data_me['veterinaria']['sitio_web'], 'https://vetcentro.cl')
        self.assertEqual(data_me['veterinaria']['estado_verificacion'], 'pendiente')

        resp_lista = self.client.get('/api/auth/veterinarias/')
        self.assertEqual(resp_lista.status_code, 200)
        self.assertEqual(resp_lista.json()['results'], [])

        perfil = VeterinariaProfile.objects.get(user__username='vet-centro')
        resp_detalle_publico = self.client.get(f'/api/auth/veterinarias/{perfil.id}/')
        self.assertEqual(resp_detalle_publico.status_code, 404)

        resp_subida_doc = self.client.patch(
            f'/api/auth/veterinarias/{perfil.id}/',
            data=json.dumps(
                {
                    'documentos_verificacion': [
                        {
                            'tipo_documento': 'patente_comercial',
                            'archivo_id': 55,
                            'archivo_url': 'http://localhost:8000/api/archivos/55/descargar/',
                            'archivo_nombre': 'patente-vet.jpg',
                        },
                        {
                            'tipo_documento': 'titulo_profesional',
                            'archivo_id': 56,
                            'archivo_url': 'http://localhost:8000/api/archivos/56/descargar/',
                            'archivo_nombre': 'titulo-vet.pdf',
                        },
                    ],
                }
            ),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )
        self.assertEqual(resp_subida_doc.status_code, 200)
        self.assertEqual(resp_subida_doc.json()['estado_verificacion'], 'pendiente')
        self.assertEqual(len(resp_subida_doc.json()['documentos_verificacion']), 2)
        self.assertEqual(VeterinariaVerificationDocument.objects.filter(veterinaria=perfil).count(), 2)

        admin = get_user_model().objects.create_user(
            username='admin-vet',
            password='Clave12345',
            email='adminvet@ejemplo.com',
            first_name='Admin',
            last_name='Vet',
            is_staff=True,
        )
        token_admin = _crear_token_acceso('secreto-pruebas', admin.id, username='admin-vet', es_admin=True)
        resp_aprobar = self.client.patch(
            f'/api/auth/veterinarias/{perfil.id}/',
            data=json.dumps({'estado_verificacion': 'aprobada'}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {token_admin}',
        )
        self.assertEqual(resp_aprobar.status_code, 200)
        self.assertEqual(resp_aprobar.json()['estado_verificacion'], 'aprobada')

        resp_lista2 = self.client.get('/api/auth/veterinarias/')
        self.assertEqual(resp_lista2.status_code, 200)
        lista = resp_lista2.json()['results']
        self.assertEqual(len(lista), 1)
        self.assertEqual(lista[0]['nombre_veterinaria'], 'Veterinaria Centro')

        resp_detalle = self.client.get(f"/api/auth/veterinarias/{lista[0]['id']}/")
        self.assertEqual(resp_detalle.status_code, 200)
        self.assertEqual(resp_detalle.json()['owner_name'], 'Ana Perez')

    def test_admin_promovido_con_token_antiguo_puede_moderar_veterinaria(self):
        User = get_user_model()
        vet_user = User.objects.create_user(
            username='vet-mod',
            password='Clave12345',
            email='vetmod@ejemplo.com',
            first_name='Vete',
            last_name='Mod',
        )
        perfil = VeterinariaProfile.objects.create(
            user=vet_user,
            nombre_veterinaria='Veterinaria Token',
            telefono='+56911111111',
            region='Región Metropolitana de Santiago',
            comuna='Santiago',
            direccion='Siempre Viva 123',
            descripcion='Prueba',
            sitio_web='https://vet-token.cl',
            latitude=-33.4489,
            longitude=-70.6693,
            activo=False,
            puede_confirmar_reportes=False,
            estado_verificacion=VeterinariaProfile.ESTADO_PENDIENTE,
        )
        perfil.documentos_verificacion.create(
            tipo_documento='patente_comercial',
            archivo_id=77,
            archivo_url='http://localhost:8000/api/archivos/77/descargar/',
            archivo_nombre='patente.pdf',
            orden=1,
        )

        admin = User.objects.create_user(
            username='moderador-token',
            password='Clave12345',
            email='moderador@ejemplo.com',
            first_name='Modo',
            last_name='Admin',
        )
        token_sin_admin = _crear_token_acceso('secreto-pruebas', admin.id, username='moderador-token', es_admin=False)
        admin.is_staff = True
        admin.is_superuser = True
        admin.save(update_fields=['is_staff', 'is_superuser'])

        resp_aprobar = self.client.patch(
            f'/api/auth/veterinarias/{perfil.id}/',
            data=json.dumps({'estado_verificacion': 'aprobada'}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {token_sin_admin}',
        )
        self.assertEqual(resp_aprobar.status_code, 200)
        perfil.refresh_from_db()
        self.assertEqual(perfil.estado_verificacion, VeterinariaProfile.ESTADO_APROBADA)
        self.assertTrue(perfil.activo)

    def test_patch_veterinaria_no_exige_csrf(self):
        client = Client(enforce_csrf_checks=True)
        User = get_user_model()
        vet_user = User.objects.create_user(
            username='vet-csrf',
            password='Clave12345',
            email='vetcsrf@ejemplo.com',
            first_name='Vet',
            last_name='Csrf',
        )
        perfil = VeterinariaProfile.objects.create(
            user=vet_user,
            nombre_veterinaria='Veterinaria CSRF',
            telefono='+56922222222',
            region='Región Metropolitana de Santiago',
            comuna='Santiago',
            direccion='Avenida CSRF 123',
            descripcion='Prueba csrf',
            sitio_web='https://vet-csrf.cl',
            latitude=-33.4489,
            longitude=-70.6693,
            activo=False,
            puede_confirmar_reportes=False,
            estado_verificacion=VeterinariaProfile.ESTADO_PENDIENTE,
        )
        perfil.documentos_verificacion.create(
            tipo_documento='patente_comercial',
            archivo_id=88,
            archivo_url='http://localhost:8000/api/archivos/88/descargar/',
            archivo_nombre='patente-csrf.pdf',
            orden=1,
        )

        admin = User.objects.create_user(
            username='admin-csrf',
            password='Clave12345',
            email='admincsrf@ejemplo.com',
            first_name='Admin',
            last_name='Csrf',
            is_staff=True,
        )
        token_admin = _crear_token_acceso('secreto-pruebas', admin.id, username='admin-csrf', es_admin=True)
        resp = client.patch(
            f'/api/auth/veterinarias/{perfil.id}/',
            data=json.dumps({'estado_verificacion': 'rechazada', 'comentario_revision': 'csrf ok'}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {token_admin}',
        )
        self.assertEqual(resp.status_code, 200)
