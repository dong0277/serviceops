"""Create services, staff availability, bookings, and conflict protection.

Revision ID: 20260828_0002
Revises: 20260828_0001
Create Date: 2026-08-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260828_0002"
down_revision: str | None = "20260828_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

booking_status = postgresql.ENUM(
    "requested",
    "confirmed",
    "in_progress",
    "completed",
    "cancelled",
    name="booking_status",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    booking_status.create(bind, checkfirst=True)

    op.create_table(
        "services",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("price_display_cents", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("duration_minutes > 0", name="ck_services_duration_positive"),
        sa.CheckConstraint(
            "price_display_cents IS NULL OR price_display_cents >= 0",
            name="ck_services_price_nonnegative",
        ),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_services_organization_id", "services", ["organization_id"])
    op.create_index("ix_services_organization_active", "services", ["organization_id", "is_active"])

    op.create_table(
        "staff_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "user_id", name="uq_staff_profiles_org_user"),
    )
    op.create_index("ix_staff_profiles_organization_id", "staff_profiles", ["organization_id"])
    op.create_index("ix_staff_profiles_user_id", "staff_profiles", ["user_id"])
    op.create_index(
        "ix_staff_profiles_organization_active",
        "staff_profiles",
        ["organization_id", "is_active"],
    )

    op.create_table(
        "staff_services",
        sa.Column("staff_profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("service_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["staff_profile_id"], ["staff_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["service_id"], ["services.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("staff_profile_id", "service_id"),
    )

    op.create_table(
        "availability_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("staff_profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("start_local_time", sa.Time(timezone=False), nullable=False),
        sa.Column("end_local_time", sa.Time(timezone=False), nullable=False),
        sa.CheckConstraint("weekday BETWEEN 0 AND 6", name="ck_availability_weekday"),
        sa.CheckConstraint("start_local_time < end_local_time", name="ck_availability_time_order"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["staff_profile_id"], ["staff_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_availability_rules_organization_id", "availability_rules", ["organization_id"]
    )
    op.create_index(
        "ix_availability_rules_staff_profile_id", "availability_rules", ["staff_profile_id"]
    )
    op.create_index(
        "ix_availability_rules_staff_weekday",
        "availability_rules",
        ["organization_id", "staff_profile_id", "weekday"],
    )

    op.create_table(
        "time_off",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("staff_profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.String(length=240), nullable=True),
        sa.CheckConstraint("starts_at < ends_at", name="ck_time_off_time_order"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["staff_profile_id"], ["staff_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_time_off_organization_id", "time_off", ["organization_id"])
    op.create_index("ix_time_off_staff_profile_id", "time_off", ["staff_profile_id"])
    op.create_index(
        "ix_time_off_staff_range",
        "time_off",
        ["organization_id", "staff_profile_id", "starts_at"],
    )

    op.create_table(
        "bookings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("staff_profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("service_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            booking_status,
            server_default="requested",
            nullable=False,
        ),
        sa.Column("customer_note", sa.Text(), nullable=True),
        sa.Column("internal_note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("starts_at < ends_at", name="ck_bookings_time_order"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["customer_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["service_id"], ["services.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["staff_profile_id"], ["staff_profiles.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bookings_organization_id", "bookings", ["organization_id"])
    op.create_index("ix_bookings_customer_user_id", "bookings", ["customer_user_id"])
    op.create_index("ix_bookings_staff_profile_id", "bookings", ["staff_profile_id"])
    op.create_index("ix_bookings_service_id", "bookings", ["service_id"])
    op.create_index("ix_bookings_starts_at", "bookings", ["starts_at"])
    op.create_index("ix_bookings_status", "bookings", ["status"])
    op.create_index(
        "ix_bookings_organization_starts_at", "bookings", ["organization_id", "starts_at"]
    )
    op.create_index(
        "ix_bookings_customer_starts_at",
        "bookings",
        ["organization_id", "customer_user_id", "starts_at"],
    )
    op.execute(
        """
        ALTER TABLE bookings
        ADD CONSTRAINT excl_bookings_staff_active_overlap
        EXCLUDE USING gist (
            staff_profile_id WITH =,
            tstzrange(starts_at, ends_at, '[)') WITH &&
        )
        WHERE (status <> 'cancelled'::booking_status)
        """
    )

    op.create_table(
        "booking_status_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("previous_status", booking_status, nullable=True),
        sa.Column("new_status", booking_status, nullable=False),
        sa.Column("changed_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["changed_by_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_booking_status_history_booking_id", "booking_status_history", ["booking_id"]
    )
    op.create_index(
        "ix_booking_status_history_changed_by_user_id",
        "booking_status_history",
        ["changed_by_user_id"],
    )
    op.create_index(
        "ix_booking_status_history_booking",
        "booking_status_history",
        ["booking_id", "changed_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_booking_status_history_booking", table_name="booking_status_history")
    op.drop_index(
        "ix_booking_status_history_changed_by_user_id", table_name="booking_status_history"
    )
    op.drop_index("ix_booking_status_history_booking_id", table_name="booking_status_history")
    op.drop_table("booking_status_history")
    op.drop_table("bookings")
    op.drop_table("time_off")
    op.drop_table("availability_rules")
    op.drop_table("staff_services")
    op.drop_table("staff_profiles")
    op.drop_table("services")
    booking_status.drop(op.get_bind(), checkfirst=True)
