from django.urls import path
from .views import login, logout, me, refresh, register, users

urlpatterns = [
    path('api/auth/register/', register, name='register'), # Agregado /
    path('api/auth/login/', login, name='login'),       # Agregado /
    path('api/auth/refresh/', refresh, name='refresh'),   # Agregado /
    path('api/auth/logout/', logout, name='logout'),     # Agregado /
    path('api/auth/me/', me, name='me'),               # Agregado /
    path('api/auth/users/', users, name='users'),       # Agregado /
]
