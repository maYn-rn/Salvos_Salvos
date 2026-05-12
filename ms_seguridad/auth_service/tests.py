import hashlib
import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from .models import RefreshToken


class AuthFlowsTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_register_and_login_issue_tokens(self):
        resp = self.client.post(
            '/api/auth/register',
            data=json.dumps({'username': 'alice', 'password': 'pass1234', 'email': 'a@a.cl'}),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 201)
        payload = resp.json()
        self.assertIn('access', payload)
        self.assertIn('refresh', payload)
        self.assertEqual(len(payload['access'].split('.')), 3)
        self.assertEqual(len(payload['refresh'].split('.')), 3)
        self.assertEqual(RefreshToken.objects.count(), 1)

        resp_login = self.client.post(
            '/api/auth/login',
            data=json.dumps({'username': 'alice', 'password': 'pass1234'}),
            content_type='application/json',
        )
        self.assertEqual(resp_login.status_code, 200)
        payload2 = resp_login.json()
        self.assertIn('access', payload2)
        self.assertIn('refresh', payload2)
        self.assertEqual(RefreshToken.objects.count(), 2)

    def test_login_invalid_credentials(self):
        User = get_user_model()
        User.objects.create_user(username='bob', password='pw')
        resp = self.client.post(
            '/api/auth/login',
            data=json.dumps({'username': 'bob', 'password': 'wrong'}),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 401)

    def test_refresh_rotates_and_revokes(self):
        self.client.post(
            '/api/auth/register',
            data=json.dumps({'username': 'alice', 'password': 'pass1234'}),
            content_type='application/json',
        )
        refresh_token = self.client.post(
            '/api/auth/login',
            data=json.dumps({'username': 'alice', 'password': 'pass1234'}),
            content_type='application/json',
        ).json()['refresh']

        token_hash = hashlib.sha256(refresh_token.encode('utf-8')).hexdigest()
        before = RefreshToken.objects.get(token_hash=token_hash)
        self.assertIsNone(before.revoked_at)
        resp = self.client.post(
            '/api/auth/refresh',
            data=json.dumps({'refresh': refresh_token}),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        self.assertIn('access', payload)
        self.assertIn('refresh', payload)
        self.assertNotEqual(payload['refresh'], refresh_token)
        before.refresh_from_db()
        self.assertIsNotNone(before.revoked_at)
        self.assertTrue(RefreshToken.objects.filter(revoked_at__isnull=True).exists())

    def test_logout_revokes_refresh(self):
        resp = self.client.post(
            '/api/auth/register',
            data=json.dumps({'username': 'alice', 'password': 'pass1234'}),
            content_type='application/json',
        )
        refresh_token = resp.json()['refresh']
        resp2 = self.client.post(
            '/api/auth/logout',
            data=json.dumps({'refresh': refresh_token}),
            content_type='application/json',
        )
        self.assertEqual(resp2.status_code, 204)
        self.assertEqual(RefreshToken.objects.filter(revoked_at__isnull=True).count(), 0)

        resp3 = self.client.post(
            '/api/auth/refresh',
            data=json.dumps({'refresh': refresh_token}),
            content_type='application/json',
        )
        self.assertEqual(resp3.status_code, 401)


class MeAndUsersTests(TestCase):
    def setUp(self):
        self.client = Client()
        User = get_user_model()
        self.user = User.objects.create_user(username='user', password='pass1234')
        self.admin = User.objects.create_user(username='admin', password='pass1234', is_staff=True)

        self.user_access = self.client.post(
            '/api/auth/login',
            data=json.dumps({'username': 'user', 'password': 'pass1234'}),
            content_type='application/json',
        ).json()['access']

        self.admin_access = self.client.post(
            '/api/auth/login',
            data=json.dumps({'username': 'admin', 'password': 'pass1234'}),
            content_type='application/json',
        ).json()['access']

    def test_me_requires_access(self):
        resp = self.client.get('/api/auth/me')
        self.assertEqual(resp.status_code, 401)

        resp2 = self.client.get('/api/auth/me', HTTP_AUTHORIZATION=f'Bearer {self.user_access}')
        self.assertEqual(resp2.status_code, 200)
        data = resp2.json()
        self.assertEqual(data['username'], 'user')

    def test_users_requires_admin(self):
        resp = self.client.get('/api/auth/users', HTTP_AUTHORIZATION=f'Bearer {self.user_access}')
        self.assertEqual(resp.status_code, 403)

        resp2 = self.client.get('/api/auth/users', HTTP_AUTHORIZATION=f'Bearer {self.admin_access}')
        self.assertEqual(resp2.status_code, 200)
        usernames = [u['username'] for u in resp2.json()['results']]
        self.assertIn('user', usernames)
        self.assertIn('admin', usernames)
