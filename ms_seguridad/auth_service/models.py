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
            models.Index(fields=['activo', 'region', 'comuna']),
            models.Index(fields=['nombre_veterinaria']),
        ]

