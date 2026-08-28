import uuid
from datetime import UTC, datetime, time
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID, ExcludeConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utc_now() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class MembershipRole(StrEnum):
    OWNER = "owner"
    STAFF = "staff"
    CUSTOMER = "customer"


class BookingStatus(StrEnum):
    REQUESTED = "requested"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Organization(Base):
    __tablename__ = "organizations"
    __table_args__ = (
        CheckConstraint("slug = lower(slug)", name="ck_organizations_slug_lowercase"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Seoul")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    memberships: Mapped[list["Membership"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
    services: Mapped[list["Service"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
    staff_profiles: Mapped[list["StaffProfile"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )
    bookings: Mapped[list["Booking"]] = relationship(back_populates="organization")
    audit_logs: Mapped[list["AuditLog"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("email = lower(email)", name="ck_users_email_lowercase"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    memberships: Mapped[list["Membership"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    auth_sessions: Mapped[list["AuthSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    staff_profiles: Mapped[list["StaffProfile"]] = relationship(back_populates="user")
    customer_bookings: Mapped[list["Booking"]] = relationship(
        back_populates="customer", foreign_keys="Booking.customer_user_id"
    )
    booking_status_changes: Mapped[list["BookingStatusHistory"]] = relationship(
        back_populates="changed_by", foreign_keys="BookingStatusHistory.changed_by_user_id"
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="actor")


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", name="uq_memberships_org_user"),
        Index("ix_memberships_organization_role", "organization_id", "role"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[MembershipRole] = mapped_column(
        Enum(
            MembershipRole,
            name="membership_role",
            values_callable=lambda roles: [r.value for r in roles],
        )
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    organization: Mapped[Organization] = relationship(back_populates="memberships")
    user: Mapped[User] = relationship(back_populates="memberships")


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    __table_args__ = (
        CheckConstraint("rotation_count >= 0", name="ck_auth_sessions_rotation_nonnegative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    access_token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    refresh_token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    csrf_token_hash: Mapped[str] = mapped_column(String(64))
    access_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    refresh_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    rotation_count: Mapped[int] = mapped_column(Integer, default=0)
    last_used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    user: Mapped[User] = relationship(back_populates="auth_sessions")


class Service(Base):
    __tablename__ = "services"
    __table_args__ = (
        CheckConstraint("duration_minutes > 0", name="ck_services_duration_positive"),
        CheckConstraint(
            "price_display_cents IS NULL OR price_display_cents >= 0",
            name="ck_services_price_nonnegative",
        ),
        Index("ix_services_organization_active", "organization_id", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    duration_minutes: Mapped[int] = mapped_column(Integer)
    price_display_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    organization: Mapped[Organization] = relationship(back_populates="services")
    staff_services: Mapped[list["StaffService"]] = relationship(
        back_populates="service", cascade="all, delete-orphan"
    )
    bookings: Mapped[list["Booking"]] = relationship(back_populates="service")


class StaffProfile(Base):
    __tablename__ = "staff_profiles"
    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", name="uq_staff_profiles_org_user"),
        Index("ix_staff_profiles_organization_active", "organization_id", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    display_name: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

    organization: Mapped[Organization] = relationship(back_populates="staff_profiles")
    user: Mapped[User] = relationship(back_populates="staff_profiles")
    staff_services: Mapped[list["StaffService"]] = relationship(
        back_populates="staff_profile", cascade="all, delete-orphan"
    )
    availability_rules: Mapped[list["AvailabilityRule"]] = relationship(
        back_populates="staff_profile", cascade="all, delete-orphan"
    )
    time_off: Mapped[list["TimeOff"]] = relationship(
        back_populates="staff_profile", cascade="all, delete-orphan"
    )
    bookings: Mapped[list["Booking"]] = relationship(back_populates="staff_profile")


class StaffService(Base):
    __tablename__ = "staff_services"

    staff_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("staff_profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("services.id", ondelete="CASCADE"), primary_key=True
    )

    staff_profile: Mapped[StaffProfile] = relationship(back_populates="staff_services")
    service: Mapped[Service] = relationship(back_populates="staff_services")


class AvailabilityRule(Base):
    __tablename__ = "availability_rules"
    __table_args__ = (
        CheckConstraint("weekday BETWEEN 0 AND 6", name="ck_availability_weekday"),
        CheckConstraint("start_local_time < end_local_time", name="ck_availability_time_order"),
        Index(
            "ix_availability_rules_staff_weekday",
            "organization_id",
            "staff_profile_id",
            "weekday",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    staff_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("staff_profiles.id", ondelete="CASCADE"), index=True
    )
    weekday: Mapped[int] = mapped_column(Integer)
    start_local_time: Mapped[time] = mapped_column(Time(timezone=False))
    end_local_time: Mapped[time] = mapped_column(Time(timezone=False))

    staff_profile: Mapped[StaffProfile] = relationship(back_populates="availability_rules")


class TimeOff(Base):
    __tablename__ = "time_off"
    __table_args__ = (
        CheckConstraint("starts_at < ends_at", name="ck_time_off_time_order"),
        Index("ix_time_off_staff_range", "organization_id", "staff_profile_id", "starts_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    staff_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("staff_profiles.id", ondelete="CASCADE"), index=True
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(String(240), nullable=True)

    staff_profile: Mapped[StaffProfile] = relationship(back_populates="time_off")


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    customer_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    staff_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("staff_profiles.id", ondelete="RESTRICT"), index=True
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("services.id", ondelete="RESTRICT"), index=True
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[BookingStatus] = mapped_column(
        Enum(
            BookingStatus,
            name="booking_status",
            values_callable=lambda statuses: [status.value for status in statuses],
        ),
        default=BookingStatus.REQUESTED,
        index=True,
    )
    customer_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    internal_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("starts_at < ends_at", name="ck_bookings_time_order"),
        Index("ix_bookings_organization_starts_at", "organization_id", "starts_at"),
        Index("ix_bookings_customer_starts_at", "organization_id", "customer_user_id", "starts_at"),
        ExcludeConstraint(
            ("staff_profile_id", "="),
            (func.tstzrange(starts_at, ends_at, "[)"), "&&"),
            where=text("status <> 'cancelled'"),
            using="gist",
            name="excl_bookings_staff_active_overlap",
        ),
    )

    organization: Mapped[Organization] = relationship(back_populates="bookings")
    customer: Mapped[User] = relationship(
        back_populates="customer_bookings", foreign_keys=[customer_user_id]
    )
    staff_profile: Mapped[StaffProfile] = relationship(back_populates="bookings")
    service: Mapped[Service] = relationship(back_populates="bookings")
    status_history: Mapped[list["BookingStatusHistory"]] = relationship(
        back_populates="booking", cascade="all, delete-orphan"
    )


class BookingStatusHistory(Base):
    __tablename__ = "booking_status_history"
    __table_args__ = (Index("ix_booking_status_history_booking", "booking_id", "changed_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bookings.id", ondelete="CASCADE"), index=True
    )
    previous_status: Mapped[BookingStatus | None] = mapped_column(
        Enum(
            BookingStatus,
            name="booking_status",
            values_callable=lambda statuses: [status.value for status in statuses],
            create_type=False,
        ),
        nullable=True,
    )
    new_status: Mapped[BookingStatus] = mapped_column(
        Enum(
            BookingStatus,
            name="booking_status",
            values_callable=lambda statuses: [status.value for status in statuses],
            create_type=False,
        )
    )
    changed_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    booking: Mapped[Booking] = relationship(back_populates="status_history")
    changed_by: Mapped[User] = relationship(
        back_populates="booking_status_changes", foreign_keys=[changed_by_user_id]
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_organization_created", "organization_id", "created_at"),
        Index("ix_audit_logs_organization_action", "organization_id", "action"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(64), index=True)
    entity_type: Mapped[str] = mapped_column(String(64))
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    organization: Mapped[Organization] = relationship(back_populates="audit_logs")
    actor: Mapped[User | None] = relationship(back_populates="audit_logs")
