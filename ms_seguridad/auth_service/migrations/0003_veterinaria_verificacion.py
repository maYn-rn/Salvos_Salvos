from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('auth_service', '0002_veterinariaprofile'),
    ]

    operations = [
        migrations.AddField(
            model_name='veterinariaprofile',
            name='comentario_revision',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='veterinariaprofile',
            name='documento_verificacion_archivo_id',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='veterinariaprofile',
            name='documento_verificacion_nombre',
            field=models.CharField(blank=True, max_length=220),
        ),
        migrations.AddField(
            model_name='veterinariaprofile',
            name='documento_verificacion_url',
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name='veterinariaprofile',
            name='estado_verificacion',
            field=models.CharField(choices=[('pendiente', 'Pendiente'), ('aprobada', 'Aprobada'), ('rechazada', 'Rechazada')], default='pendiente', max_length=20),
        ),
        migrations.AddField(
            model_name='veterinariaprofile',
            name='verificado_en',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='veterinariaprofile',
            name='verificado_por',
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AlterField(
            model_name='veterinariaprofile',
            name='activo',
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name='veterinariaprofile',
            name='puede_confirmar_reportes',
            field=models.BooleanField(default=False),
        ),
    ]
