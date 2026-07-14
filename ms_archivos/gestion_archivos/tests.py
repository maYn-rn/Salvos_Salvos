import base64
import hashlib
import hmac
import json
import tempfile
import time

from django.test import Client, TestCase, override_settings


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


@override_settings(
    JWT_SECRET='secreto-pruebas',
    SUPABASE_URL='',
    SUPABASE_SERVICE_ROLE_KEY='',
    SUPABASE_STORAGE_BUCKET='',
    SUPABASE_STORAGE_PUBLIC=False,
)
class GestionArchivosTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.token = _crear_token_acceso('secreto-pruebas', 10, username='u10', es_admin=False)
        self.token_admin = _crear_token_acceso('secreto-pruebas', 99, username='admin', es_admin=True)

    def test_post_requiere_autorizacion(self):
        resp = self.client.post('/api/archivos/', data=b'{}', content_type='application/json')
        self.assertEqual(resp.status_code, 401)

    def test_subida_base64_listado_detalle_y_borrado(self):
        with tempfile.TemporaryDirectory() as carpeta:
            with override_settings(RUTA_BASE_ARCHIVOS=carpeta, MAXIMO_ARCHIVOS_POR_ENTIDAD=3, LIMITE_TAMANO_ARCHIVO_BYTES=1024 * 1024):
                contenido = b'contenido-imagen'
                base64_data = base64.b64encode(contenido).decode('ascii')
                resp = self.client.post(
                    '/api/archivos/',
                    data=json.dumps(
                        {
                            'tipo_entidad': 'adopcion',
                            'id_entidad': 1,
                            'categoria': 'principal',
                            'orden': 1,
                            'servicio_origen': 'ms_adopciones',
                            'nombre_original': 'foto.png',
                            'contenido_base64': f'data:image/png;base64,{base64_data}',
                        }
                    ),
                    content_type='application/json',
                    HTTP_AUTHORIZATION=f'Bearer {self.token}',
                )
                self.assertEqual(resp.status_code, 201)
                archivo = resp.json()
                self.assertIn('id', archivo)
                self.assertIn('url_descarga', archivo)

                resp_list = self.client.get('/api/archivos/?tipo_entidad=adopcion&id_entidad=1')
                self.assertEqual(resp_list.status_code, 200)
                self.assertEqual(len(resp_list.json().get('results') or []), 1)

                resp_detalle = self.client.get(f"/api/archivos/{archivo['id']}/")
                self.assertEqual(resp_detalle.status_code, 200)

                resp_descarga = self.client.get(f"/api/archivos/{archivo['id']}/descargar/")
                self.assertEqual(resp_descarga.status_code, 200)
                self.assertEqual(resp_descarga.content, contenido)

                resp_delete = self.client.delete(
                    f"/api/archivos/{archivo['id']}/",
                    HTTP_AUTHORIZATION=f'Bearer {self.token}',
                )
                self.assertEqual(resp_delete.status_code, 204)

                resp_detalle_publico = self.client.get(f"/api/archivos/{archivo['id']}/")
                self.assertEqual(resp_detalle_publico.status_code, 404)

                resp_detalle_admin = self.client.get(
                    f"/api/archivos/{archivo['id']}/",
                    HTTP_AUTHORIZATION=f'Bearer {self.token_admin}',
                )
                self.assertEqual(resp_detalle_admin.status_code, 200)

    def test_limite_maximo_por_entidad(self):
        with tempfile.TemporaryDirectory() as carpeta:
            with override_settings(RUTA_BASE_ARCHIVOS=carpeta, MAXIMO_ARCHIVOS_POR_ENTIDAD=3, LIMITE_TAMANO_ARCHIVO_BYTES=1024 * 1024):
                for numero in range(1, 4):
                    base64_data = base64.b64encode(f'img{numero}'.encode('utf-8')).decode('ascii')
                    resp = self.client.post(
                        '/api/archivos/',
                        data=json.dumps(
                            {
                                'tipo_entidad': 'reporte',
                                'id_entidad': 7,
                                'categoria': 'galeria',
                                'orden': numero,
                                'servicio_origen': 'ms_mascotas',
                                'contenido_base64': f'data:image/png;base64,{base64_data}',
                            }
                        ),
                        content_type='application/json',
                        HTTP_AUTHORIZATION=f'Bearer {self.token}',
                    )
                    self.assertEqual(resp.status_code, 201)

                base64_data = base64.b64encode(b'img4').decode('ascii')
                resp = self.client.post(
                    '/api/archivos/',
                    data=json.dumps(
                        {
                            'tipo_entidad': 'reporte',
                            'id_entidad': 7,
                            'categoria': 'galeria',
                            'orden': 4,
                            'servicio_origen': 'ms_mascotas',
                            'contenido_base64': f'data:image/png;base64,{base64_data}',
                        }
                    ),
                    content_type='application/json',
                    HTTP_AUTHORIZATION=f'Bearer {self.token}',
                )
                self.assertEqual(resp.status_code, 400)
                self.assertEqual(resp.json().get('detail'), 'maximo_archivos_por_entidad_alcanzado')

    def test_subida_pdf_base64(self):
        with tempfile.TemporaryDirectory() as carpeta:
            with override_settings(RUTA_BASE_ARCHIVOS=carpeta, MAXIMO_ARCHIVOS_POR_ENTIDAD=5, LIMITE_TAMANO_ARCHIVO_BYTES=1024 * 1024):
                contenido = b'%PDF-1.4 documento-prueba'
                base64_data = base64.b64encode(contenido).decode('ascii')
                resp = self.client.post(
                    '/api/archivos/',
                    data=json.dumps(
                        {
                            'tipo_entidad': 'veterinaria_verificacion',
                            'id_entidad': 15,
                            'categoria': 'titulo_profesional',
                            'orden': 1,
                            'servicio_origen': 'ms_seguridad',
                            'nombre_original': 'titulo.pdf',
                            'contenido_base64': f'data:application/pdf;base64,{base64_data}',
                        }
                    ),
                    content_type='application/json',
                    HTTP_AUTHORIZATION=f'Bearer {self.token}',
                )
                self.assertEqual(resp.status_code, 201)
                self.assertEqual(resp.json()['tipo_mime'], 'application/pdf')
                self.assertEqual(resp.json()['extension'], '.pdf')
