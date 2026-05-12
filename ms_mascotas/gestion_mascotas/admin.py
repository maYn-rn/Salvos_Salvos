from django.contrib import admin
from django.utils import timezone

from .models import LostPetReport


@admin.action(description='Confirmar reportes seleccionados')
def confirm_reports(modeladmin, request, queryset):
    queryset.update(is_confirmed=True, confirmed_at=timezone.now(), confirmed_by=request.user.get_username())


@admin.action(description='Desconfirmar reportes seleccionados')
def unconfirm_reports(modeladmin, request, queryset):
    queryset.update(is_confirmed=False, confirmed_at=None, confirmed_by='')


@admin.register(LostPetReport)
class LostPetReportAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'pet_name',
        'species',
        'region',
        'comuna',
        'status',
        'is_confirmed',
        'reporter_id',
        'created_at',
    )
    list_filter = ('is_confirmed', 'species', 'status', 'region')
    search_fields = ('pet_name', 'species', 'region', 'comuna', 'contact_phone', 'contact_email')
    readonly_fields = ('created_at', 'updated_at', 'confirmed_at', 'confirmed_by')
    actions = (confirm_reports, unconfirm_reports)
