from django.db import migrations, models


def forwards(apps, schema_editor):
    LostPetReport = apps.get_model('gestion_mascotas', 'LostPetReport')
    LostPetReport.objects.filter(status='lost').update(status='perdido')
    LostPetReport.objects.filter(status='found').update(status='encontrado')


def backwards(apps, schema_editor):
    LostPetReport = apps.get_model('gestion_mascotas', 'LostPetReport')
    LostPetReport.objects.filter(status='perdido').update(status='lost')
    LostPetReport.objects.filter(status='encontrado').update(status='found')


class Migration(migrations.Migration):
    dependencies = [
        ('gestion_mascotas', '0004_lostpetreport_confirmed_at_and_more'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(
            model_name='lostpetreport',
            name='status',
            field=models.CharField(
                choices=[('perdido', 'Perdido'), ('encontrado', 'Encontrado')],
                default='perdido',
                max_length=20,
            ),
        ),
    ]

