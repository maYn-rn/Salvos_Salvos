from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('gestion_mascotas', '0005_status_perdido_encontrado'),
    ]

    operations = [
        migrations.CreateModel(
            name='FoundPetLead',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('finder_id', models.IntegerField()),
                ('found_location', models.CharField(max_length=220)),
                ('image_data_url', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('report', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='found_leads', to='gestion_mascotas.lostpetreport')),
            ],
        ),
    ]
