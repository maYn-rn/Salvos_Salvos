from django.contrib import admin
from django.utils import timezone

from .models import AdoptionListing


@admin.action(description='Confirmar publicaciones seleccionadas')
def confirm_listings(modeladmin, request, queryset):
    queryset.update(is_confirmed=True, confirmed_at=timezone.now(), confirmed_by=request.user.get_username())


@admin.action(description='Desconfirmar publicaciones seleccionadas')
def unconfirm_listings(modeladmin, request, queryset):
    queryset.update(is_confirmed=False, confirmed_at=None, confirmed_by='')


@admin.register(AdoptionListing)
class AdoptionListingAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'pet_name',
        'species',
        'publisher_type',
        'region',
        'comuna',
        'is_confirmed',
        'publisher_id',
        'created_at',
    )
    list_filter = ('is_confirmed', 'publisher_type', 'species', 'region')
    search_fields = ('pet_name', 'breed', 'region', 'comuna', 'contact_name', 'contact_phone', 'contact_email', 'shelter_name')
    readonly_fields = ('created_at', 'updated_at', 'confirmed_at', 'confirmed_by')
    actions = (confirm_listings, unconfirm_listings)
