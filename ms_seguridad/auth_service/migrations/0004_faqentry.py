import datetime
import django.db.models.deletion
from django.db import migrations, models
from django.conf import settings


def seed_faq_entries(apps, schema_editor):
    FaqEntry = apps.get_model('auth_service', 'FaqEntry')
    if FaqEntry.objects.exists():
        return

    utc = datetime.timezone.utc

    FaqEntry.objects.bulk_create([
        FaqEntry(
            question='¿Cómo funciona el sistema de confirmación de reportes?',
            answer='Cuando un usuario publica un reporte, este queda en estado pendiente hasta que el equipo administrador revise la información y lo publique.',
            user_type='admin',
            username_snapshot='Equipo administrador',
            answered_by_snapshot='Equipo administrador',
            answered_at=datetime.datetime(2026, 6, 1, 12, 0, tzinfo=utc),
        ),
        FaqEntry(
            question='¿Tiene algún costo publicar un aviso de mascota perdida?',
            answer='No. Sanos y Salvos es una plataforma comunitaria y publicar reportes o pistas no tiene costo para los usuarios.',
            user_type='admin',
            username_snapshot='Equipo administrador',
            answered_by_snapshot='Equipo administrador',
            answered_at=datetime.datetime(2026, 6, 5, 12, 0, tzinfo=utc),
        ),
        FaqEntry(
            question='¿Qué debo hacer si avisto una mascota perdida en la calle?',
            answer='Si puedes, mantén contacto visual con la mascota y revisa el reporte para contactar al responsable. También puedes publicar una pista con la ubicación más precisa posible.',
            user_type='user',
            username_snapshot='vecino_santiago',
            answered_by_snapshot='Equipo administrador',
            answered_at=datetime.datetime(2026, 6, 10, 12, 0, tzinfo=utc),
        ),
    ])


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('auth_service', '0003_veterinaria_verificacion'),
    ]

    operations = [
        migrations.CreateModel(
            name='FaqEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('question', models.TextField()),
                ('answer', models.TextField(blank=True)),
                ('user_type', models.CharField(choices=[('admin', 'Admin'), ('user', 'User')], default='user', max_length=20)),
                ('username_snapshot', models.CharField(blank=True, max_length=150)),
                ('answered_by_snapshot', models.CharField(blank=True, max_length=150)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('answered_at', models.DateTimeField(blank=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('answered_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='faq_answers', to=settings.AUTH_USER_MODEL)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='faq_questions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='faqentry',
            index=models.Index(fields=['user_type', 'created_at'], name='auth_servic_user_ty_88c898_idx'),
        ),
        migrations.AddIndex(
            model_name='faqentry',
            index=models.Index(fields=['answered_at'], name='auth_servic_answere_0cbf46_idx'),
        ),
        migrations.RunPython(seed_faq_entries, migrations.RunPython.noop),
    ]
