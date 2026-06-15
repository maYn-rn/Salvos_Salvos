from django.urls import path
from .views import found_lead_detail, report_detail, report_found_leads, reports

urlpatterns = [
    # Quitamos 'api/reports' porque el BFF ya lo incluye en la llamada
    path('', reports, name='reports'), 
    path('<int:report_id>/', report_detail, name='report_detail'),
    path('<int:report_id>/found-leads/', report_found_leads, name='report_found_leads'),
    path('found-leads/<int:lead_id>/', found_lead_detail, name='found_lead_detail'),
]
