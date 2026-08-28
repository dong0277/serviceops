import csv
import io
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, time, timedelta
from threading import Barrier
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from app.domain_schemas import BookingCreate
from app.errors import ApiError
from app.models import (
    AuditLog,
    AvailabilityRule,
    Booking,
    BookingStatus,
    Membership,
    MembershipRole,
    Organization,
    Service,
    StaffProfile,
    StaffService,
    TimeOff,
    User,
)
from app.security import hash_password
from app.services.bookings import create_booking
from tests.conftest import create_identity

ORIGIN = "http://localhost:3001"
PASSWORD = "Correct-Horse-2026!"


def login_for_writes(client: TestClient, email: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": email, "password": PASSWORD},
    )
    assert response.status_code == 200
    return {"Origin": ORIGIN, "X-CSRF-Token": response.json()["csrf_token"]}


def future_slot(*, days: int = 7, hour: int = 10) -> datetime:
    timezone = ZoneInfo("Asia/Seoul")
    target = datetime.now(timezone).date() + timedelta(days=days)
    return datetime.combine(target, time(hour=hour), timezone)


def create_domain(
    db: Session,
    organization: Organization,
    *,
    starts_at: datetime,
) -> tuple[Service, StaffProfile]:
    staff_user = create_identity(
        db,
        organization,
        email=f"staff.{uuid.uuid4()}@serviceops.test",
        role=MembershipRole.STAFF,
        display_name="테스트 기사",
    )
    service = Service(
        organization_id=organization.id,
        name="방문 점검",
        description="현장 상태를 점검합니다.",
        duration_minutes=60,
        price_display_cents=55000,
    )
    staff = StaffProfile(
        organization_id=organization.id,
        user_id=staff_user.id,
        display_name="테스트 기사",
    )
    db.add_all([service, staff])
    db.flush()
    db.add_all(
        [
            StaffService(staff_profile_id=staff.id, service_id=service.id),
            AvailabilityRule(
                organization_id=organization.id,
                staff_profile_id=staff.id,
                weekday=starts_at.astimezone(ZoneInfo("Asia/Seoul")).weekday(),
                start_local_time=time(9),
                end_local_time=time(18),
            ),
        ]
    )
    db.commit()
    return service, staff


def booking_payload(service: Service, staff: StaffProfile, starts_at: datetime) -> dict[str, str]:
    return {
        "service_id": str(service.id),
        "staff_profile_id": str(staff.id),
        "starts_at": starts_at.isoformat(),
        "customer_note": "도착 전에 연락해 주세요.",
    }


def test_owner_service_crud_and_public_active_filter(
    client: TestClient,
    db: Session,
    demo_organization: Organization,
) -> None:
    create_identity(
        db,
        demo_organization,
        email="catalog.owner@serviceops.test",
        role=MembershipRole.OWNER,
    )
    headers = login_for_writes(client, "catalog.owner@serviceops.test")
    created = client.post(
        f"/api/v1/organizations/{demo_organization.slug}/owner/services",
        headers=headers,
        json={
            "name": "  정기 청소  ",
            "description": "정기 방문 서비스",
            "duration_minutes": 120,
            "price_display_cents": 79000,
        },
    )
    assert created.status_code == 201
    assert created.json()["name"] == "정기 청소"
    service_id = created.json()["id"]

    updated = client.patch(
        f"/api/v1/organizations/{demo_organization.slug}/owner/services/{service_id}",
        headers=headers,
        json={"duration_minutes": 90},
    )
    assert updated.status_code == 200
    assert updated.json()["duration_minutes"] == 90
    assert len(client.get(f"/api/v1/organizations/{demo_organization.slug}/services").json()) == 1

    deleted = client.delete(
        f"/api/v1/organizations/{demo_organization.slug}/owner/services/{service_id}",
        headers=headers,
    )
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/organizations/{demo_organization.slug}/services").json() == []
    owner_list = client.get(f"/api/v1/organizations/{demo_organization.slug}/owner/services")
    assert owner_list.status_code == 200
    assert owner_list.json()[0]["is_active"] is False


def test_service_write_requires_owner_and_csrf(
    client: TestClient,
    db: Session,
    demo_organization: Organization,
) -> None:
    create_identity(
        db,
        demo_organization,
        email="catalog.customer@serviceops.test",
        role=MembershipRole.CUSTOMER,
    )
    headers = login_for_writes(client, "catalog.customer@serviceops.test")
    path = f"/api/v1/organizations/{demo_organization.slug}/owner/services"
    forbidden = client.post(
        path,
        headers=headers,
        json={"name": "서비스", "duration_minutes": 60},
    )
    assert forbidden.status_code == 403
    assert forbidden.json()["error"]["code"] == "role_forbidden"

    no_csrf = client.post(
        path,
        headers={"Origin": ORIGIN},
        json={"name": "서비스", "duration_minutes": 60},
    )
    assert no_csrf.status_code == 403
    assert no_csrf.json()["error"]["code"] == "csrf_failed"


def test_slots_exclude_time_off_and_existing_bookings(
    client: TestClient,
    db: Session,
    demo_organization: Organization,
) -> None:
    starts_at = future_slot()
    service, staff = create_domain(db, demo_organization, starts_at=starts_at)
    customer = create_identity(
        db,
        demo_organization,
        email="slots.customer@serviceops.test",
        role=MembershipRole.CUSTOMER,
    )
    blocked_by_booking = starts_at + timedelta(hours=2)
    blocked_by_time_off = starts_at + timedelta(hours=4)
    db.add_all(
        [
            Booking(
                organization_id=demo_organization.id,
                customer_user_id=customer.id,
                staff_profile_id=staff.id,
                service_id=service.id,
                starts_at=blocked_by_booking,
                ends_at=blocked_by_booking + timedelta(hours=1),
                status=BookingStatus.CONFIRMED,
            ),
            TimeOff(
                organization_id=demo_organization.id,
                staff_profile_id=staff.id,
                starts_at=blocked_by_time_off,
                ends_at=blocked_by_time_off + timedelta(hours=1),
                reason="현장 교육",
            ),
        ]
    )
    db.commit()

    local_date = starts_at.astimezone(ZoneInfo("Asia/Seoul")).date().isoformat()
    response = client.get(
        f"/api/v1/organizations/{demo_organization.slug}/slots",
        params={
            "service_id": str(service.id),
            "date_from": local_date,
            "date_to": local_date,
        },
    )
    assert response.status_code == 200
    slot_starts = {datetime.fromisoformat(slot["starts_at"]) for slot in response.json()}
    assert starts_at.astimezone(UTC) in slot_starts
    assert blocked_by_booking.astimezone(UTC) not in slot_starts
    assert blocked_by_time_off.astimezone(UTC) not in slot_starts


def test_customer_booking_conflict_cancel_and_isolation(
    client: TestClient,
    db: Session,
    demo_organization: Organization,
) -> None:
    starts_at = future_slot(days=8)
    service, staff = create_domain(db, demo_organization, starts_at=starts_at)
    create_identity(
        db,
        demo_organization,
        email="booking.one@serviceops.test",
        role=MembershipRole.CUSTOMER,
        display_name="첫 고객",
    )
    create_identity(
        db,
        demo_organization,
        email="booking.two@serviceops.test",
        role=MembershipRole.CUSTOMER,
        display_name="둘째 고객",
    )
    path = f"/api/v1/organizations/{demo_organization.slug}/bookings"
    first_headers = login_for_writes(client, "booking.one@serviceops.test")
    created = client.post(
        path,
        headers=first_headers,
        json=booking_payload(service, staff, starts_at),
    )
    assert created.status_code == 201
    booking_id = created.json()["id"]
    assert "internal_note" not in created.json()

    second_headers = login_for_writes(client, "booking.two@serviceops.test")
    conflict = client.post(
        path,
        headers=second_headers,
        json=booking_payload(service, staff, starts_at),
    )
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "booking_conflict"
    assert client.get(path).json() == []
    hidden = client.get(f"{path}/{booking_id}")
    assert hidden.status_code == 404

    first_headers = login_for_writes(client, "booking.one@serviceops.test")
    cancelled = client.post(f"{path}/{booking_id}/cancel", headers=first_headers)
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"

    second_headers = login_for_writes(client, "booking.two@serviceops.test")
    available_again = client.post(
        path,
        headers=second_headers,
        json=booking_payload(service, staff, starts_at),
    )
    assert available_again.status_code == 201


def test_reschedule_conflict_and_owner_internal_view(
    client: TestClient,
    db: Session,
    demo_organization: Organization,
) -> None:
    starts_at = future_slot(days=9)
    service, staff = create_domain(db, demo_organization, starts_at=starts_at)
    first_customer = create_identity(
        db,
        demo_organization,
        email="reschedule.one@serviceops.test",
        role=MembershipRole.CUSTOMER,
    )
    second_customer = create_identity(
        db,
        demo_organization,
        email="reschedule.two@serviceops.test",
        role=MembershipRole.CUSTOMER,
    )
    create_identity(
        db,
        demo_organization,
        email="bookings.owner@serviceops.test",
        role=MembershipRole.OWNER,
    )
    first = Booking(
        organization_id=demo_organization.id,
        customer_user_id=first_customer.id,
        staff_profile_id=staff.id,
        service_id=service.id,
        starts_at=starts_at,
        ends_at=starts_at + timedelta(hours=1),
        status=BookingStatus.CONFIRMED,
        internal_note="고객에게 공개하면 안 되는 메모",
    )
    second = Booking(
        organization_id=demo_organization.id,
        customer_user_id=second_customer.id,
        staff_profile_id=staff.id,
        service_id=service.id,
        starts_at=starts_at + timedelta(hours=2),
        ends_at=starts_at + timedelta(hours=3),
        status=BookingStatus.REQUESTED,
    )
    db.add_all([first, second])
    db.commit()

    headers = login_for_writes(client, "reschedule.two@serviceops.test")
    response = client.patch(
        f"/api/v1/organizations/{demo_organization.slug}/bookings/{second.id}",
        headers=headers,
        json={"staff_profile_id": str(staff.id), "starts_at": starts_at.isoformat()},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "booking_conflict"

    login_for_writes(client, "bookings.owner@serviceops.test")
    owner_list = client.get(f"/api/v1/organizations/{demo_organization.slug}/owner/bookings")
    assert owner_list.status_code == 200
    owner_first = next(item for item in owner_list.json() if item["id"] == str(first.id))
    assert owner_first["internal_note"] == "고객에게 공개하면 안 되는 메모"


def test_database_exclusion_constraint_handles_concurrent_attempts(
    migrated_engine: Engine,
) -> None:
    organization_id = uuid.uuid4()
    service_id = uuid.uuid4()
    staff_profile_id = uuid.uuid4()
    customer_ids = [uuid.uuid4(), uuid.uuid4()]
    starts_at = future_slot(days=14)
    with Session(migrated_engine) as setup:
        organization = Organization(
            id=organization_id,
            name="동시성 테스트",
            slug=f"concurrency-{uuid.uuid4()}",
            timezone="Asia/Seoul",
        )
        staff_user = User(
            email=f"staff.concurrent.{uuid.uuid4()}@serviceops.test",
            password_hash=hash_password(PASSWORD),
            display_name="동시성 기사",
        )
        customers = [
            User(
                id=customer_id,
                email=f"customer.concurrent.{customer_id}@serviceops.test",
                password_hash=hash_password(PASSWORD),
                display_name=f"동시성 고객 {index}",
            )
            for index, customer_id in enumerate(customer_ids)
        ]
        service = Service(
            id=service_id,
            organization=organization,
            name="동시 예약 서비스",
            duration_minutes=60,
        )
        staff = StaffProfile(
            id=staff_profile_id,
            organization=organization,
            user=staff_user,
            display_name="동시성 기사",
        )
        setup.add_all([organization, staff_user, *customers, service, staff])
        setup.flush()
        setup.add_all(
            [
                Membership(
                    organization_id=organization_id,
                    user_id=customer.id,
                    role=MembershipRole.CUSTOMER,
                )
                for customer in customers
            ]
            + [
                Membership(
                    organization_id=organization_id,
                    user_id=staff_user.id,
                    role=MembershipRole.STAFF,
                ),
                StaffService(staff_profile_id=staff_profile_id, service_id=service_id),
                AvailabilityRule(
                    organization_id=organization_id,
                    staff_profile_id=staff_profile_id,
                    weekday=starts_at.astimezone(ZoneInfo("Asia/Seoul")).weekday(),
                    start_local_time=time(9),
                    end_local_time=time(18),
                ),
            ]
        )
        setup.commit()

    barrier = Barrier(2)

    def attempt(customer_id: uuid.UUID) -> str:
        with Session(migrated_engine, expire_on_commit=False) as session:
            barrier.wait()
            try:
                create_booking(
                    session,
                    organization_id,
                    "Asia/Seoul",
                    customer_id,
                    BookingCreate(
                        service_id=service_id,
                        staff_profile_id=staff_profile_id,
                        starts_at=starts_at,
                    ),
                )
            except ApiError as exc:
                return exc.code
            return "created"

    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes = list(executor.map(attempt, customer_ids))

    assert sorted(outcomes) == ["booking_conflict", "created"]


def test_staff_assigned_work_status_transitions_and_audit(
    client: TestClient,
    db: Session,
    demo_organization: Organization,
) -> None:
    starts_at = future_slot(days=16)
    service, staff = create_domain(db, demo_organization, starts_at=starts_at)
    other_service, other_staff = create_domain(
        db,
        demo_organization,
        starts_at=starts_at + timedelta(days=1),
    )
    customer = create_identity(
        db,
        demo_organization,
        email="staff-flow.customer@serviceops.test",
        role=MembershipRole.CUSTOMER,
        display_name="운영 고객",
    )
    assigned = Booking(
        organization_id=demo_organization.id,
        customer_user_id=customer.id,
        staff_profile_id=staff.id,
        service_id=service.id,
        starts_at=starts_at,
        ends_at=starts_at + timedelta(hours=1),
        status=BookingStatus.REQUESTED,
        internal_note="도구를 준비하세요.",
    )
    other = Booking(
        organization_id=demo_organization.id,
        customer_user_id=customer.id,
        staff_profile_id=other_staff.id,
        service_id=other_service.id,
        starts_at=starts_at + timedelta(days=1),
        ends_at=starts_at + timedelta(days=1, hours=1),
        status=BookingStatus.REQUESTED,
    )
    db.add_all([assigned, other])
    db.commit()

    staff_user = db.get(User, staff.user_id)
    assert staff_user is not None
    staff_email = staff_user.email
    headers = login_for_writes(client, staff_email)
    path = f"/api/v1/organizations/{demo_organization.slug}/staff/bookings"
    listed = client.get(path)
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [str(assigned.id)]
    assert listed.json()[0]["internal_note"] == "도구를 준비하세요."

    hidden = client.get(f"{path}/{other.id}")
    assert hidden.status_code == 404

    confirmed = client.patch(
        f"{path}/{assigned.id}/status",
        headers=headers,
        json={"status": "confirmed"},
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "confirmed"
    assert confirmed.json()["status_history"][-1]["new_status"] == "confirmed"

    invalid = client.patch(
        f"{path}/{assigned.id}/status",
        headers=headers,
        json={"status": "completed"},
    )
    assert invalid.status_code == 409
    assert invalid.json()["error"]["code"] == "invalid_status_transition"

    audit = db.scalar(
        select(AuditLog).where(
            AuditLog.organization_id == demo_organization.id,
            AuditLog.entity_id == assigned.id,
            AuditLog.action == "booking_status_changed",
        )
    )
    assert audit is not None
    assert audit.actor_user_id == staff.user_id
    assert audit.metadata_json == {
        "previous_status": "requested",
        "new_status": "confirmed",
    }


def test_owner_reassigns_booking_and_customer_cannot_see_internal_note(
    client: TestClient,
    db: Session,
    demo_organization: Organization,
) -> None:
    starts_at = future_slot(days=18)
    service, original_staff = create_domain(db, demo_organization, starts_at=starts_at)
    replacement_user = create_identity(
        db,
        demo_organization,
        email="replacement.staff@serviceops.test",
        role=MembershipRole.STAFF,
        display_name="교체 기사",
    )
    replacement = StaffProfile(
        organization_id=demo_organization.id,
        user_id=replacement_user.id,
        display_name="교체 기사",
    )
    db.add(replacement)
    db.flush()
    db.add_all(
        [
            StaffService(staff_profile_id=replacement.id, service_id=service.id),
            AvailabilityRule(
                organization_id=demo_organization.id,
                staff_profile_id=replacement.id,
                weekday=starts_at.astimezone(ZoneInfo("Asia/Seoul")).weekday(),
                start_local_time=time(9),
                end_local_time=time(18),
            ),
        ]
    )
    customer = create_identity(
        db,
        demo_organization,
        email="owner-flow.customer@serviceops.test",
        role=MembershipRole.CUSTOMER,
    )
    create_identity(
        db,
        demo_organization,
        email="owner-flow.owner@serviceops.test",
        role=MembershipRole.OWNER,
    )
    booking = Booking(
        organization_id=demo_organization.id,
        customer_user_id=customer.id,
        staff_profile_id=original_staff.id,
        service_id=service.id,
        starts_at=starts_at,
        ends_at=starts_at + timedelta(hours=1),
        status=BookingStatus.REQUESTED,
    )
    db.add(booking)
    db.commit()

    owner_headers = login_for_writes(client, "owner-flow.owner@serviceops.test")
    owner_path = f"/api/v1/organizations/{demo_organization.slug}/owner/bookings/{booking.id}"
    updated = client.patch(
        owner_path,
        headers=owner_headers,
        json={
            "staff_profile_id": str(replacement.id),
            "internal_note": "현관 비밀번호는 통화로 확인",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["staff"]["id"] == str(replacement.id)
    assert updated.json()["internal_note"] == "현관 비밀번호는 통화로 확인"

    confirmed = client.patch(
        f"{owner_path}/status",
        headers=owner_headers,
        json={"status": "confirmed"},
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "confirmed"

    customer_headers = login_for_writes(client, "owner-flow.customer@serviceops.test")
    customer_view = client.get(
        f"/api/v1/organizations/{demo_organization.slug}/bookings/{booking.id}",
        headers=customer_headers,
    )
    assert customer_view.status_code == 200
    assert "internal_note" not in customer_view.json()


def test_owner_customer_view_csv_sanitization_and_audit_log(
    client: TestClient,
    db: Session,
    demo_organization: Organization,
) -> None:
    starts_at = future_slot(days=20)
    service, staff = create_domain(db, demo_organization, starts_at=starts_at)
    service.name = "+SUM(1,1)"
    staff.display_name = "@danger"
    customer = create_identity(
        db,
        demo_organization,
        email="csv.customer@serviceops.test",
        role=MembershipRole.CUSTOMER,
        display_name="=2+2",
    )
    create_identity(
        db,
        demo_organization,
        email="csv.owner@serviceops.test",
        role=MembershipRole.OWNER,
    )
    booking = Booking(
        organization_id=demo_organization.id,
        customer_user_id=customer.id,
        staff_profile_id=staff.id,
        service_id=service.id,
        starts_at=starts_at,
        ends_at=starts_at + timedelta(hours=1),
        status=BookingStatus.REQUESTED,
    )
    db.add(booking)
    db.commit()

    login_for_writes(client, "csv.owner@serviceops.test")
    base = f"/api/v1/organizations/{demo_organization.slug}/owner"
    customers = client.get(f"{base}/customers")
    assert customers.status_code == 200
    customer_row = next(item for item in customers.json() if item["id"] == str(customer.id))
    assert customer_row["booking_count"] == 1

    exported = client.get(f"{base}/bookings/export", params={"status": "requested"})
    assert exported.status_code == 200
    rows = list(csv.reader(io.StringIO(exported.text)))
    exported_row = next(row for row in rows[1:] if row[0] == str(booking.id))
    assert exported_row[5] == "'+SUM(1,1)"
    assert exported_row[6] == "'@danger"
    assert exported_row[7] == "'=2+2"

    audits = client.get(f"{base}/audit-logs", params={"action": "csv_export_requested"})
    assert audits.status_code == 200
    assert audits.json()[0]["metadata_json"]["row_count"] >= 1


def test_owner_dashboard_metrics_are_real_and_organization_scoped(
    client: TestClient,
    db: Session,
    demo_organization: Organization,
) -> None:
    timezone = ZoneInfo("Asia/Seoul")
    today = datetime.now(timezone).date()
    starts_today = datetime.combine(today, time(10), timezone)
    service, staff = create_domain(db, demo_organization, starts_at=starts_today)
    customer = create_identity(
        db,
        demo_organization,
        email="dashboard.customer@serviceops.test",
        role=MembershipRole.CUSTOMER,
        display_name="대시보드 고객",
    )
    create_identity(
        db,
        demo_organization,
        email="dashboard.owner@serviceops.test",
        role=MembershipRole.OWNER,
    )
    db.add_all(
        [
            Booking(
                organization_id=demo_organization.id,
                customer_user_id=customer.id,
                staff_profile_id=staff.id,
                service_id=service.id,
                starts_at=starts_today,
                ends_at=starts_today + timedelta(hours=1),
                status=BookingStatus.REQUESTED,
            ),
            Booking(
                organization_id=demo_organization.id,
                customer_user_id=customer.id,
                staff_profile_id=staff.id,
                service_id=service.id,
                starts_at=starts_today - timedelta(days=1),
                ends_at=starts_today - timedelta(days=1) + timedelta(hours=1),
                status=BookingStatus.COMPLETED,
            ),
            Booking(
                organization_id=demo_organization.id,
                customer_user_id=customer.id,
                staff_profile_id=staff.id,
                service_id=service.id,
                starts_at=starts_today - timedelta(days=2),
                ends_at=starts_today - timedelta(days=2) + timedelta(hours=1),
                status=BookingStatus.CANCELLED,
            ),
        ]
    )
    db.commit()

    login_for_writes(client, "dashboard.owner@serviceops.test")
    path = f"/api/v1/organizations/{demo_organization.slug}/owner/dashboard"
    response = client.get(path, params={"period_days": 7})
    assert response.status_code == 200
    dashboard = response.json()
    assert dashboard["today"] == today.isoformat()
    assert dashboard["period_start"] == (today - timedelta(days=6)).isoformat()
    assert dashboard["today_booking_count"] == 1
    assert dashboard["period_booking_count"] == 3
    assert dashboard["completion_rate"] == 33.3
    assert dashboard["cancellation_count"] == 1
    assert dashboard["requested_count"] == 1
    assert dashboard["today_schedule"][0]["customer_display_name"] == "대시보드 고객"
    assert {item["status"]: item["count"] for item in dashboard["status_counts"]} == {
        "requested": 1,
        "confirmed": 0,
        "in_progress": 0,
        "completed": 1,
        "cancelled": 1,
    }
    assert dashboard["service_counts"] == [
        {
            "service_id": str(service.id),
            "service_name": service.name,
            "count": 3,
        }
    ]
    assert dashboard["staff_workload"][0]["count"] == 2

    login_for_writes(client, "dashboard.customer@serviceops.test")
    forbidden = client.get(path)
    assert forbidden.status_code == 403
