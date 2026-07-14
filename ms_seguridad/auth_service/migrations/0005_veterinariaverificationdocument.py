from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('auth_service', '0004_faqentry'),
    ]

    operations = [
        migrations.CreateModel(
            name='VeterinariaVerificationDocument',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tipo_documento', models.CharField(choices=[('patente_comercial', 'Patente comercial'), ('inicio_actividades', 'Inicio de actividades'), ('rut_empresa', 'RUT empresa'), ('titulo_profesional', 'Título profesional'), ('certificado_sanitario', 'Certificado sanitario'), ('otro', 'Otro')], default='otro', max_length=40)),
                ('archivo_id', models.IntegerField()),
                ('archivo_url', models.URLField()),
                ('archivo_nombre', models.CharField(max_length=220)),
                ('orden', models.PositiveIntegerField(default=1)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('veterinaria', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='documentos_verificacion', to='auth_service.veterinariaprofile')),
            ],
            options={
                'ordering': ['orden', 'id'],
            },
        ),
        migrations.AddIndex(
            model_name='veterinariaverificationdocument',
            index=models.Index(fields=['veterinaria', 'orden'], name='auth_servic_vet_doc_orden_idx'),
        ),
        migrations.AddIndex(
            model_name='veterinariaverificationdocument',
            index=models.Index(fields=['tipo_documento'], name='auth_servic_vet_doc_tipo_idx'),
        ),
    ]
