from django.urls import path

from .views import archivo_descargar, archivo_detalle, archivos

urlpatterns = [
    path('', archivos, name='archivos'),
    path('<int:archivo_id>/', archivo_detalle, name='archivo_detalle'),
    path('<int:archivo_id>/descargar/', archivo_descargar, name='archivo_descargar'),
]
