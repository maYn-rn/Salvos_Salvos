"""
URL configuration for bff_web project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path

from .api_views import (
    archivo_descargar_proxy,
    archivo_detalle_proxy,
    archivos_proxy,
    adoption_detail_proxy,
    adoptions_proxy,
    auth_login,
    auth_logout,
    auth_me,
    auth_refresh,
    auth_register,
    auth_users,
    auth_veterinaria_detail,
    auth_veterinarias,
    report_detail_proxy,
    report_found_lead_detail_proxy,
    report_found_leads_proxy,
    reports_proxy,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/register/', auth_register),
    path('api/auth/login/', auth_login),
    path('api/auth/refresh/', auth_refresh),
    path('api/auth/logout/', auth_logout),
    path('api/auth/me/', auth_me),
    path('api/auth/users/', auth_users),
    path('api/auth/veterinarias/', auth_veterinarias),
    path('api/auth/veterinarias/<int:veterinaria_id>/', auth_veterinaria_detail),
    path('api/reports/', reports_proxy),
    path('api/reports/<int:report_id>/', report_detail_proxy),
    path('api/reports/<int:report_id>/found-leads/', report_found_leads_proxy),
    path('api/reports/found-leads/<int:lead_id>/', report_found_lead_detail_proxy),
    path('api/adoptions/', adoptions_proxy),
    path('api/adoptions/<int:adoption_id>/', adoption_detail_proxy),
    path('api/archivos/', archivos_proxy),
    path('api/archivos/<int:archivo_id>/', archivo_detalle_proxy),
    path('api/archivos/<int:archivo_id>/descargar/', archivo_descargar_proxy),
]
