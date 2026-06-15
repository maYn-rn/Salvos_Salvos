from django.db import models


class AdoptionListing(models.Model):
    PUBLISHER_TYPE_CHOICES = [
        ('persona', 'Persona'),
        ('albergue', 'Albergue'),
    ]

    pet_name = models.CharField(max_length=100)
    species = models.CharField(max_length=50)
    breed = models.CharField(max_length=100, blank=True)
    age_label = models.CharField(max_length=80, blank=True)
    sex = models.CharField(max_length=30, blank=True)
    size = models.CharField(max_length=30, blank=True)
    description = models.TextField(blank=True)
    image_data_url = models.TextField(blank=True)
    imagenes = models.JSONField(default=list, blank=True)
    color = models.CharField(max_length=120, blank=True)
    is_sterilized = models.BooleanField(null=True, blank=True)
    vaccines_up_to_date = models.BooleanField(null=True, blank=True)
    has_microchip = models.BooleanField(null=True, blank=True)
    adoption_reason = models.TextField(blank=True)
    behavior_notes = models.TextField(blank=True)
    region = models.CharField(max_length=100)
    comuna = models.CharField(max_length=100)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    publisher_type = models.CharField(max_length=20, choices=PUBLISHER_TYPE_CHOICES, default='persona')
    shelter_name = models.CharField(max_length=150, blank=True)
    health_notes = models.TextField(blank=True)
    contact_name = models.CharField(max_length=120)
    contact_phone = models.CharField(max_length=50, blank=True)
    contact_email = models.EmailField(blank=True)
    publisher_id = models.IntegerField()
    is_confirmed = models.BooleanField(default=False)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmed_by = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['region', 'comuna']),
            models.Index(fields=['publisher_type', 'species']),
            models.Index(fields=['created_at']),
        ]
