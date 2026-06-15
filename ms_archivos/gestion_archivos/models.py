from django.db import models


class Archivo(models.Model):
    nombre_original = models.CharField(max_length=255)
    nombre_guardado = models.CharField(max_length=255, unique=True)
    ruta_relativa = models.CharField(max_length=500, unique=True)
    tipo_mime = models.CharField(max_length=120)
    extension = models.CharField(max_length=20, blank=True)
    tamano_bytes = models.PositiveIntegerField()
    huella_sha256 = models.CharField(max_length=64, blank=True)
    servicio_origen = models.CharField(max_length=80, blank=True)
    tipo_entidad = models.CharField(max_length=80)
    id_entidad = models.PositiveIntegerField()
    categoria = models.CharField(max_length=40, default='general')
    orden = models.PositiveSmallIntegerField(default=1)
    usuario_cargador_id = models.IntegerField()
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['tipo_entidad', 'id_entidad', 'activo']),
            models.Index(fields=['servicio_origen', 'tipo_entidad']),
            models.Index(fields=['usuario_cargador_id', 'creado_en']),
            models.Index(fields=['categoria', 'orden']),
        ]
        ordering = ['orden', '-creado_en']
