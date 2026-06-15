from django.contrib import admin

from .models import Archivo


@admin.register(Archivo)
class ArchivoAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'nombre_original',
        'tipo_entidad',
        'id_entidad',
        'categoria',
        'orden',
        'activo',
        'creado_en',
    )
    list_filter = ('tipo_entidad', 'categoria', 'activo', 'creado_en')
    search_fields = ('nombre_original', 'servicio_origen', 'tipo_entidad')
