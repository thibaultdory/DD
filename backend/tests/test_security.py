import unittest
from types import SimpleNamespace

from fastapi import HTTPException

from app.core.dependencies import validate_csrf
from app.routers.auth import get_preprovisioned_user, get_verified_email


class FakeScalarResult:
    def __init__(self, user):
        self.user = user

    def first(self):
        return self.user


class FakeResult:
    def __init__(self, user):
        self.user = user

    def scalars(self):
        return FakeScalarResult(self.user)


class FakeDatabase:
    def __init__(self, user):
        self.user = user
        self.execute_calls = 0

    async def execute(self, _statement):
        self.execute_calls += 1
        return FakeResult(self.user)


class GoogleIdentityTests(unittest.IsolatedAsyncioTestCase):
    def test_verified_email_is_normalized(self):
        user_info = {"email": " Family.Member@Example.COM ", "email_verified": True}
        self.assertEqual(get_verified_email(user_info), "family.member@example.com")

    def test_unverified_or_missing_email_is_rejected(self):
        self.assertIsNone(get_verified_email({"email": "member@example.com", "email_verified": False}))
        self.assertIsNone(get_verified_email({"email_verified": True}))

    async def test_preprovisioned_user_is_accepted(self):
        expected_user = object()
        database = FakeDatabase(expected_user)
        user = await get_preprovisioned_user(database, "member@example.com")
        self.assertIs(user, expected_user)
        self.assertEqual(database.execute_calls, 1)

    async def test_unknown_user_is_rejected_without_creation(self):
        database = FakeDatabase(None)
        user = await get_preprovisioned_user(database, "unknown@example.com")
        self.assertIsNone(user)
        self.assertEqual(database.execute_calls, 1)


class CsrfTests(unittest.IsolatedAsyncioTestCase):
    async def test_safe_method_does_not_require_token(self):
        request = SimpleNamespace(method="GET", session={}, headers={})
        await validate_csrf(request)

    async def test_matching_session_and_header_tokens_are_accepted(self):
        request = SimpleNamespace(
            method="POST",
            session={"csrf_token": "known-token"},
            headers={"X-CSRF-Token": "known-token"},
        )
        await validate_csrf(request)

    async def test_missing_or_incorrect_token_is_rejected(self):
        requests = [
            SimpleNamespace(method="POST", session={"csrf_token": "known-token"}, headers={}),
            SimpleNamespace(
                method="POST",
                session={"csrf_token": "known-token"},
                headers={"X-CSRF-Token": "wrong-token"},
            ),
        ]
        for request in requests:
            with self.subTest(headers=request.headers):
                with self.assertRaises(HTTPException) as raised:
                    await validate_csrf(request)
                self.assertEqual(raised.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
