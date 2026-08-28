import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import Database
from app.models import (
    AvailabilityRule,
    Booking,
    BookingStatus,
    BookingStatusHistory,
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

DEMO_PASSWORD = "ServiceOps-Demo-2026!"
DEMO_NAMESPACE = uuid.UUID("2c23a8a2-e55b-49b3-b79b-81aa94ec93f8")


@dataclass(frozen=True)
class DemoIdentity:
    email: str
    display_name: str
    role: MembershipRole


DEMO_IDENTITIES = (
    DemoIdentity("owner@serviceops.test", "김민준 점주", MembershipRole.OWNER),
    DemoIdentity("staff.hana@serviceops.test", "이하나 기사", MembershipRole.STAFF),
    DemoIdentity("staff.jun@serviceops.test", "박준호 기사", MembershipRole.STAFF),
    DemoIdentity("customer.sora@serviceops.test", "최소라 고객", MembershipRole.CUSTOMER),
    DemoIdentity("customer.yun@serviceops.test", "정윤서 고객", MembershipRole.CUSTOMER),
    DemoIdentity("customer.min@serviceops.test", "한민지 고객", MembershipRole.CUSTOMER),
)


@dataclass(frozen=True)
class DemoService:
    key: str
    name: str
    description: str
    duration_minutes: int
    price_display_cents: int


DEMO_SERVICES = (
    DemoService("cleaning", "정기 청소", "공간 상태에 맞춘 정기 방문 청소", 120, 79000),
    DemoService("repair", "방문 수리", "증상을 확인하고 현장에서 수리 가능 여부를 안내", 60, 49000),
    DemoService("training", "1:1 트레이닝", "목표와 컨디션을 반영한 개인 세션", 50, 65000),
)


def stable_id(label: str) -> uuid.UUID:
    return uuid.uuid5(DEMO_NAMESPACE, label)


def seed_identity_data(db: Session) -> None:
    organization = db.scalar(select(Organization).where(Organization.slug == "demo-services"))
    if organization is None:
        organization = Organization(
            id=stable_id("organization:demo-services"),
            name="ServiceOps 데모 서비스",
            slug="demo-services",
            timezone="Asia/Seoul",
        )
        db.add(organization)
        db.flush()
    else:
        organization.name = "ServiceOps 데모 서비스"
        organization.timezone = "Asia/Seoul"

    for identity in DEMO_IDENTITIES:
        user = db.scalar(select(User).where(User.email == identity.email))
        if user is None:
            user = User(
                id=stable_id(f"user:{identity.email}"),
                email=identity.email,
                password_hash=hash_password(DEMO_PASSWORD),
                display_name=identity.display_name,
            )
            db.add(user)
            db.flush()
        else:
            user.display_name = identity.display_name
            user.is_active = True

        membership = db.scalar(
            select(Membership).where(
                Membership.organization_id == organization.id,
                Membership.user_id == user.id,
            )
        )
        if membership is None:
            db.add(
                Membership(
                    id=stable_id(f"membership:{organization.slug}:{identity.email}"),
                    organization_id=organization.id,
                    user_id=user.id,
                    role=identity.role,
                )
            )
        else:
            membership.role = identity.role

    db.commit()


def _demo_local_datetime(day_offset: int, hour: int, minute: int = 0) -> datetime:
    timezone = ZoneInfo("Asia/Seoul")
    target_date = datetime.now(timezone).date() + timedelta(days=day_offset)
    return datetime.combine(target_date, time(hour, minute), timezone).astimezone(UTC)


def seed_booking_data(db: Session) -> None:
    organization = db.scalar(select(Organization).where(Organization.slug == "demo-services"))
    if organization is None:
        raise RuntimeError("Identity data must be seeded before booking data.")

    services: dict[str, Service] = {}
    for demo in DEMO_SERVICES:
        service_id = stable_id(f"service:{demo.key}")
        service = db.get(Service, service_id)
        if service is None:
            service = Service(id=service_id, organization_id=organization.id)
            db.add(service)
        service.name = demo.name
        service.description = demo.description
        service.duration_minutes = demo.duration_minutes
        service.price_display_cents = demo.price_display_cents
        service.is_active = True
        services[demo.key] = service
    db.flush()

    staff_definitions = (
        (
            "hana",
            "staff.hana@serviceops.test",
            "이하나 기사",
            ("cleaning", "training"),
            time(9),
            time(18),
        ),
        (
            "jun",
            "staff.jun@serviceops.test",
            "박준호 기사",
            ("cleaning", "repair"),
            time(10),
            time(19),
        ),
    )
    staff_profiles: dict[str, StaffProfile] = {}
    for key, email, display_name, service_keys, starts, ends in staff_definitions:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            raise RuntimeError(f"Missing seeded staff user: {email}")
        staff_id = stable_id(f"staff-profile:{key}")
        staff = db.get(StaffProfile, staff_id)
        if staff is None:
            staff = StaffProfile(
                id=staff_id,
                organization_id=organization.id,
                user_id=user.id,
                display_name=display_name,
            )
            db.add(staff)
        staff.display_name = display_name
        staff.is_active = True
        staff_profiles[key] = staff
        db.flush()

        for service_key in service_keys:
            assignment = db.get(StaffService, (staff.id, services[service_key].id))
            if assignment is None:
                db.add(
                    StaffService(
                        staff_profile_id=staff.id,
                        service_id=services[service_key].id,
                    )
                )
        for weekday in range(6):
            rule_id = stable_id(f"availability:{key}:{weekday}")
            rule = db.get(AvailabilityRule, rule_id)
            if rule is None:
                rule = AvailabilityRule(
                    id=rule_id,
                    organization_id=organization.id,
                    staff_profile_id=staff.id,
                    weekday=weekday,
                    start_local_time=starts,
                    end_local_time=ends,
                )
                db.add(rule)
            else:
                rule.start_local_time = starts
                rule.end_local_time = ends

    time_off_id = stable_id("time-off:hana:demo")
    time_off = db.get(TimeOff, time_off_id)
    if time_off is None:
        time_off = TimeOff(
            id=time_off_id,
            organization_id=organization.id,
            staff_profile_id=staff_profiles["hana"].id,
            starts_at=_demo_local_datetime(4, 13),
            ends_at=_demo_local_datetime(4, 15),
            reason="정기 교육",
        )
        db.add(time_off)

    customer_by_key = {
        "sora": db.scalar(select(User).where(User.email == "customer.sora@serviceops.test")),
        "yun": db.scalar(select(User).where(User.email == "customer.yun@serviceops.test")),
        "min": db.scalar(select(User).where(User.email == "customer.min@serviceops.test")),
    }
    if any(customer is None for customer in customer_by_key.values()):
        raise RuntimeError("Missing seeded customer users.")

    booking_definitions = (
        (
            "completed-cleaning",
            "sora",
            "hana",
            "cleaning",
            _demo_local_datetime(-1, 9),
            BookingStatus.COMPLETED,
            "현관 앞에서 연락 부탁드립니다.",
            "재방문 선호 고객",
        ),
        (
            "confirmed-repair",
            "yun",
            "jun",
            "repair",
            _demo_local_datetime(1, 11),
            BookingStatus.CONFIRMED,
            "보일러 소음이 납니다.",
            None,
        ),
        (
            "requested-cleaning",
            "min",
            "hana",
            "cleaning",
            _demo_local_datetime(2, 10),
            BookingStatus.REQUESTED,
            None,
            None,
        ),
        (
            "cancelled-training",
            "sora",
            "hana",
            "training",
            _demo_local_datetime(3, 16),
            BookingStatus.CANCELLED,
            "첫 상담 포함",
            None,
        ),
    )
    for (
        key,
        customer_key,
        staff_key,
        service_key,
        starts_at,
        status,
        customer_note,
        internal_note,
    ) in booking_definitions:
        booking_id = stable_id(f"booking:{key}")
        booking = db.get(Booking, booking_id)
        if booking is not None:
            continue
        service = services[service_key]
        customer = customer_by_key[customer_key]
        if customer is None:
            continue
        ends_at = starts_at + timedelta(minutes=service.duration_minutes)
        conflicting_booking = db.scalar(
            select(Booking.id).where(
                Booking.staff_profile_id == staff_profiles[staff_key].id,
                Booking.status != BookingStatus.CANCELLED,
                Booking.starts_at < ends_at,
                Booking.ends_at > starts_at,
            )
        )
        if conflicting_booking is not None and status != BookingStatus.CANCELLED:
            continue
        booking = Booking(
            id=booking_id,
            organization_id=organization.id,
            customer_user_id=customer.id,
            staff_profile_id=staff_profiles[staff_key].id,
            service_id=service.id,
            starts_at=starts_at,
            ends_at=ends_at,
            status=status,
            customer_note=customer_note,
            internal_note=internal_note,
            cancelled_at=starts_at - timedelta(days=1)
            if status == BookingStatus.CANCELLED
            else None,
        )
        db.add(booking)
        db.flush()
        db.add(
            BookingStatusHistory(
                id=stable_id(f"booking-history:{key}"),
                booking_id=booking.id,
                previous_status=None,
                new_status=status,
                changed_by_user_id=customer.id,
            )
        )

    db.commit()


def main() -> None:
    settings = get_settings()
    if settings.app_env not in {"development", "test"}:
        raise RuntimeError("Demo seed data is restricted to development and test environments.")
    database = Database(settings.sqlalchemy_database_url)
    try:
        with database.session_factory() as db:
            seed_identity_data(db)
            seed_booking_data(db)
    finally:
        database.dispose()
    print(
        f"Seeded {len(DEMO_IDENTITIES)} fictional identities, "
        f"{len(DEMO_SERVICES)} services, staff availability, and bookings in demo-services."
    )


if __name__ == "__main__":
    main()
