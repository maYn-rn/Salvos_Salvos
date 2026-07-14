from django.conf import settings
from django.db import models


class RefreshToken(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    jti = models.CharField(max_length=64, unique=True)
    token_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    replaced_by_jti = models.CharField(max_length=64, null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'revoked_at']),
            models.Index(fields=['expires_at']),
        ]


class VeterinariaProfile(models.Model):
    ESTADO_PENDIENTE = 'pendiente'
    ESTADO_APROBADA = 'aprobada'
    ESTADO_RECHAZADA = 'rechazada'
    ESTADOS_VERIFICACION = [
        (ESTADO_PENDIENTE, 'Pendiente'),
        (ESTADO_APROBADA, 'Aprobada'),
        (ESTADO_RECHAZADA, 'Rechazada'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='perfil_veterinaria',
    )
    nombre_veterinaria = models.CharField(max_length=180)
    telefono = models.CharField(max_length=40)
    region = models.CharField(max_length=120)
    comuna = models.CharField(max_length=120)
    direccion = models.CharField(max_length=220)
    descripcion = models.TextField(blank=True)
    sitio_web = models.URLField(blank=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    activo = models.BooleanField(default=False)
    puede_confirmar_reportes = models.BooleanField(default=False)
    estado_verificacion = models.CharField(max_length=20, choices=ESTADOS_VERIFICACION, default=ESTADO_PENDIENTE)
    documento_verificacion_archivo_id = models.IntegerField(null=True, blank=True)
    documento_verificacion_url = models.URLField(blank=True)
    documento_verificacion_nombre = models.CharField(max_length=220, blank=True)
    comentario_revision = models.TextField(blank=True)
    verificado_por = models.CharField(max_length=150, blank=True)
    verificado_en = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['activo', 'region', 'comuna'], name='auth_servic_activo_8d6d1e_idx'),
            models.Index(fields=['nombre_veterinaria'], name='auth_servic_nombre__de4a22_idx'),
        ]


class VeterinariaVerificationDocument(models.Model):
    TIPO_PATENTE_COMERCIAL = 'patente_comercial'
    TIPO_INICIO_ACTIVIDADES = 'inicio_actividades'
    TIPO_RUT_EMPRESA = 'rut_empresa'
    TIPO_TITULO_PROFESIONAL = 'titulo_profesional'
    TIPO_CERTIFICADO_SANITARIO = 'certificado_sanitario'
    TIPO_OTRO = 'otro'
    TIPOS_DOCUMENTO = [
        (TIPO_PATENTE_COMERCIAL, 'Patente comercial'),
        (TIPO_INICIO_ACTIVIDADES, 'Inicio de actividades'),
        (TIPO_RUT_EMPRESA, 'RUT empresa'),
        (TIPO_TITULO_PROFESIONAL, 'Título profesional'),
        (TIPO_CERTIFICADO_SANITARIO, 'Certificado sanitario'),
        (TIPO_OTRO, 'Otro'),
    ]

    veterinaria = models.ForeignKey(
        VeterinariaProfile,
        on_delete=models.CASCADE,
        related_name='documentos_verificacion',
    )
    tipo_documento = models.CharField(max_length=40, choices=TIPOS_DOCUMENTO, default=TIPO_OTRO)
    archivo_id = models.IntegerField()
    archivo_url = models.URLField()
    archivo_nombre = models.CharField(max_length=220)
    orden = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['orden', 'id']
        indexes = [
            models.Index(fields=['veterinaria', 'orden'], name='auth_servic_vet_doc_orden_idx'),
            models.Index(fields=['tipo_documento'], name='auth_servic_vet_doc_tipo_idx'),
        ]


class FaqEntry(models.Model):
    USER_TYPE_ADMIN = 'admin'
    USER_TYPE_USER = 'user'
    USER_TYPES = [
        (USER_TYPE_ADMIN, 'Admin'),
        (USER_TYPE_USER, 'User'),
    ]

    question = models.TextField()
    answer = models.TextField(blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='faq_questions',
    )
    answered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='faq_answers',
    )
    user_type = models.CharField(max_length=20, choices=USER_TYPES, default=USER_TYPE_USER)
    username_snapshot = models.CharField(max_length=150, blank=True)
    answered_by_snapshot = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    answered_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user_type', 'created_at'], name='auth_servic_user_ty_88c898_idx'),
            models.Index(fields=['answered_at'], name='auth_servic_answere_0cbf46_idx'),
        ]

