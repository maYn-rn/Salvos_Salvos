from django.urls import path
from .views import report_detail, reports

urlpatterns = [
    # Quitamos 'api/reports' porque el BFF ya lo incluye en la llamada
    path('', reports, name='reports'), 
    path('<int:report_id>/', report_detail, name='report_detail'),
]