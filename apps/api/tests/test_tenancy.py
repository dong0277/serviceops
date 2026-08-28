from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import MembershipRole, Organization
from tests.conftest import create_identity


def login(client: TestClient, email: str) -> None:
    response = client.post(
        "/api/v1/auth/login",
        headers={"Origin": "http://localhost:3001"},
        json={"email": email, "password": "Correct-Horse-2026!"},
    )
    assert response.status_code == 200


def test_owner_role_and_organization_scope_are_enforced(
    client: TestClient,
    db: Session,
    demo_organization: Organization,
) -> None:
    other_organization = Organization(
        name="다른 조직",
        slug="other-services",
        timezone="Asia/Seoul",
    )
    db.add(other_organization)
    db.commit()
    create_identity(
        db,
        demo_organization,
        email="owner.a@serviceops.test",
        role=MembershipRole.OWNER,
        display_name="A 조직 점주",
    )
    create_identity(
        db,
        demo_organization,
        email="staff.a@serviceops.test",
        role=MembershipRole.STAFF,
        display_name="A 조직 기사",
    )
    create_identity(
        db,
        other_organization,
        email="owner.b@serviceops.test",
        role=MembershipRole.OWNER,
        display_name="B 조직 점주",
    )

    login(client, "owner.a@serviceops.test")
    own_members = client.get(f"/api/v1/organizations/{demo_organization.slug}/members")
    assert own_members.status_code == 200
    assert {member["email"] for member in own_members.json()} == {
        "owner.a@serviceops.test",
        "staff.a@serviceops.test",
    }

    cross_organization = client.get(f"/api/v1/organizations/{other_organization.slug}/members")
    assert cross_organization.status_code == 404
    assert cross_organization.json()["error"]["code"] == "organization_not_found"

    login(client, "staff.a@serviceops.test")
    staff_attempt = client.get(f"/api/v1/organizations/{demo_organization.slug}/members")
    assert staff_attempt.status_code == 403
    assert staff_attempt.json()["error"]["code"] == "role_forbidden"


def test_members_endpoint_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/v1/organizations/test-services/members")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_required"
