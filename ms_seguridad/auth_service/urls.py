from django.urls import path
from .views import (
    login,
    logout,
    me,
    refresh,
    register,
    users,
    veterinaria_detail,
    veterinarias,
)

urlpatterns = [
    path('api/auth/register/', register, name='register'), # Agregado /
    path('api/auth/login/', login, name='login'),       # Agregado /
    path('api/auth/refresh/', refresh, name='refresh'),   # Agregado /
    path('api/auth/logout/', logout, name='logout'),     # Agregado /
    path('api/auth/me/', me, name='me'),               # Agregado /
    path('api/auth/users/', users, name='users'),       # Agregado /
    path('api/auth/veterinarias/', veterinarias, name='veterinarias'),
    path('api/auth/veterinarias/<int:veterinaria_id>/', veterinaria_detail, name='veterinaria_detail'),
]
