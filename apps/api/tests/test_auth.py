from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuthSession, MembershipRole, Organization, User
from app.security import ACCESS_COOKIE_NAME, CSRF_COOKIE_NAME, REFRESH_COOKIE_NAME, verify_password
from tests.conftest import create_identity


def test_customer_can_register_and_get_current_identity(
    client: TestClient,
    db: Session,
    demo_organization: Organization,
) -> None:
    response = client.post(
        "/api/v1/auth/register",
        headers={"Origin": "http://localhost:3001"},
        json={
            "email": "New.Customer@ServiceOps.test",
            "password": "Customer-Pass-2026!",
            "display_name": "  새   고객  ",
            "organization_slug": demo_organization.slug,
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["user"]["email"] == "new.customer@serviceops.test"
    assert payload["user"]["display_name"] == "새 고객"
    assert payload["user"]["memberships"][0]["role"] == "customer"
    assert client.cookies.get(ACCESS_COOKIE_NAME)
    assert client.cookies.get(REFRESH_COOKIE_NAME)
    assert client.cookies.get(CSRF_COOKIE_NAME) == payload["csrf_token"]

    user = db.scalar(select(User).where(User.email == "new.customer@serviceops.test"))
    assert user is not None
    assert user.password_hash.startswith("$argon2id$")
    assert verify_password("Customer-Pass-2026!", user.password_hash)
    assert not verify_password("wrong-password", user.password_hash)

    me_response = client.get("/api/v1/auth/me")
    assert me_response.status_code == 200
    assert me_response.json()["id"] == payload["user"]["id"]


def test_login_failure_is_non_enumerating(
    client: TestClient,
    db: Session,
    demo_organization: Organization,
) -> None:
    create_identity(
        db,
        demo_organization,
        email="known@serviceops.test",
        role=MembershipRole.CUSTOMER,
    )
    headers = {"Origin": "http://localhost:3001"}
    existing = client.post(
        "/api/v1/auth/login",
        headers=headers,
        json={"email": "known@serviceops.test", "password": "incorrect"},
    )
    missing = client.post(
        "/api/v1/auth/login",
        headers=headers,
        json={"email": "missing@serviceops.test", "password": "incorrect"},
    )

    assert existing.status_code == missing.status_code == 401
    assert (
        existing.json()
        == missing.json()
        == {
            "error": {
                "code": "invalid_credentials",
                "message": "Email or password is incorrect.",
            }
        }
    )


def test_refresh_rotates_credentials_and_logout_revokes_session(
    client: TestClient,
    db: Session,
    demo_organization: Organization,
) -> None:
    create_identity(
        db,
        demo_organization,
        email="owner@serviceops.test",
        role=MembershipRole.OWNER,
    )
    login = client.post(
        "/api/v1/auth/login",
        headers={"Origin": "http://localhost:3001"},
        json={"email": "owner@serviceops.test", "password": "Correct-Horse-2026!"},
    )
    assert login.status_code == 200
    old_access = client.cookies.get(ACCESS_COOKIE_NAME)
    old_refresh = client.cookies.get(REFRESH_COOKIE_NAME)
    csrf = client.cookies.get(CSRF_COOKIE_NAME)
    assert csrf is not None

    refresh = client.post(
        "/api/v1/auth/refresh",
        headers={"Origin": "http://localhost:3001", "X-CSRF-Token": csrf},
    )
    assert refresh.status_code == 200
    assert client.cookies.get(ACCESS_COOKIE_NAME) != old_access
    assert client.cookies.get(REFRESH_COOKIE_NAME) != old_refresh

    next_csrf = client.cookies.get(CSRF_COOKIE_NAME)
    assert next_csrf is not None
    logout = client.post(
        "/api/v1/auth/logout",
        headers={"Origin": "http://localhost:3001", "X-CSRF-Token": next_csrf},
    )
    assert logout.status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 401
    auth_session = db.scalar(select(AuthSession))
    assert auth_session is not None
    assert auth_session.rotation_count == 1
    assert auth_session.revoked_at is not None


def test_refresh_requires_matching_csrf(
    client: TestClient,
    db: Session,
    demo_organization: Organization,
) -> None:
    create_identity(
        db,
        demo_organization,
        email="csrf@serviceops.test",
        role=MembershipRole.CUSTOMER,
    )
    client.post(
        "/api/v1/auth/login",
        headers={"Origin": "http://localhost:3001"},
        json={"email": "csrf@serviceops.test", "password": "Correct-Horse-2026!"},
    )

    response = client.post(
        "/api/v1/auth/refresh",
        headers={"Origin": "http://localhost:3001", "X-CSRF-Token": "wrong-token"},
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "csrf_failed"


def test_login_rate_limit_and_origin_check(client: TestClient) -> None:
    untrusted = client.post(
        "/api/v1/auth/login",
        headers={"Origin": "https://malicious.example"},
        json={"email": "missing@serviceops.test", "password": "incorrect"},
    )
    assert untrusted.status_code == 403
    assert untrusted.json()["error"]["code"] == "untrusted_origin"

    for _ in range(5):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "limited@serviceops.test", "password": "incorrect"},
        )
        assert response.status_code == 401
    limited = client.post(
        "/api/v1/auth/login",
        json={"email": "limited@serviceops.test", "password": "incorrect"},
    )
    assert limited.status_code == 429
    assert limited.headers["Retry-After"]
