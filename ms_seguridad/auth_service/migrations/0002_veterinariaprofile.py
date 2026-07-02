from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('auth_service', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='VeterinariaProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre_veterinaria', models.CharField(max_length=180)),
                ('telefono', models.CharField(max_length=40)),
                ('region', models.CharField(max_length=120)),
                ('comuna', models.CharField(max_length=120)),
                ('direccion', models.CharField(max_length=220)),
                ('descripcion', models.TextField(blank=True)),
                ('sitio_web', models.URLField(blank=True)),
                ('latitude', models.FloatField()),
                ('longitude', models.FloatField()),
                ('activo', models.BooleanField(default=True)),
                ('puede_confirmar_reportes', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='perfil_veterinaria', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'indexes': [
                    models.Index(fields=['activo', 'region', 'comuna'], name='auth_servic_activo_8d6d1e_idx'),
                    models.Index(fields=['nombre_veterinaria'], name='auth_servic_nombre__de4a22_idx'),
                ],
            },
        ),
    ]
