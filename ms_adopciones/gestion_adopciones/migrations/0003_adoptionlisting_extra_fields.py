from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('gestion_adopciones', '0002_rename_gestion_adop_adoptio_7e2f02_idx_gestion_ado_adoptio_b1db15_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='adoptionlisting',
            name='is_urgent',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='adoptionlisting',
            name='color',
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name='adoptionlisting',
            name='is_sterilized',
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='adoptionlisting',
            name='vaccines_up_to_date',
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='adoptionlisting',
            name='has_microchip',
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='adoptionlisting',
            name='adoption_reason',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='adoptionlisting',
            name='behavior_notes',
            field=models.TextField(blank=True),
        ),
    ]

