import csv
import io
import uuid
from collections import Counter
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.domain_schemas import (
    DashboardServiceMetric,
    DashboardStaffMetric,
    DashboardStatusMetric,
    OwnerCustomerResponse,
    OwnerDashboardResponse,
)
from app.models import Booking, BookingStatus, Membership, MembershipRole, User
from app.services.audit import AuditAction, record_audit
from app.services.bookings import find_owner_bookings, to_owner_response


def get_owner_dashboard(
    db: Session,
    organization_id: uuid.UUID,
    timezone_name: str,
    period_days: int,
) -> OwnerDashboardResponse:
    timezone = ZoneInfo(timezone_name)
    today = datetime.now(timezone).date()
    period_start = today - timedelta(days=period_days - 1)
    period_bookings = find_owner_bookings(
        db,
        organization_id,
        timezone_name,
        date_from=period_start,
        date_to=today,
    )
    today_schedule = sorted(
        find_owner_bookings(
            db,
            organization_id,
            timezone_name,
            date_from=today,
            date_to=today,
        ),
        key=lambda booking: (booking.starts_at, booking.id),
    )

    status_counts = Counter(booking.status for booking in period_bookings)
    service_counts: Counter[tuple[uuid.UUID, str]] = Counter(
        (booking.service.id, booking.service.name) for booking in period_bookings
    )
    staff_counts: Counter[tuple[uuid.UUID, str]] = Counter(
        (booking.staff_profile.id, booking.staff_profile.display_name)
        for booking in period_bookings
        if booking.status != BookingStatus.CANCELLED
    )
    total = len(period_bookings)
    completed = status_counts[BookingStatus.COMPLETED]

    return OwnerDashboardResponse(
        timezone=timezone_name,
        today=today,
        period_days=period_days,
        period_start=period_start,
        period_end=today,
        today_booking_count=len(today_schedule),
        period_booking_count=total,
        completion_rate=round((completed / total) * 100, 1) if total else 0,
        cancellation_count=status_counts[BookingStatus.CANCELLED],
        requested_count=status_counts[BookingStatus.REQUESTED],
        status_counts=[
            DashboardStatusMetric(status=status, count=status_counts[status])
            for status in BookingStatus
        ],
        service_counts=[
            DashboardServiceMetric(service_id=service_id, service_name=name, count=count)
            for (service_id, name), count in sorted(
                service_counts.items(), key=lambda item: (-item[1], item[0][1], item[0][0])
            )
        ],
        staff_workload=[
            DashboardStaffMetric(
                staff_profile_id=staff_profile_id,
                staff_display_name=name,
                count=count,
            )
            for (staff_profile_id, name), count in sorted(
                staff_counts.items(), key=lambda item: (-item[1], item[0][1], item[0][0])
            )
        ],
        today_schedule=[to_owner_response(booking) for booking in today_schedule],
    )


CSV_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def list_owner_customers(
    db: Session,
    organization_id: uuid.UUID,
) -> list[OwnerCustomerResponse]:
    rows = db.execute(
        select(
            User.id,
            User.display_name,
            User.email,
            User.is_active,
            func.count(Booking.id),
            func.max(Booking.starts_at),
        )
        .join(
            Membership,
            and_(
                Membership.user_id == User.id,
                Membership.organization_id == organization_id,
                Membership.role == MembershipRole.CUSTOMER,
            ),
        )
        .outerjoin(
            Booking,
            and_(
                Booking.organization_id == organization_id,
                Booking.customer_user_id == User.id,
            ),
        )
        .group_by(User.id)
        .order_by(User.display_name, User.email, User.id)
    ).all()
    return [
        OwnerCustomerResponse(
            id=user_id,
            display_name=display_name,
            email=email,
            is_active=is_active,
            booking_count=booking_count,
            last_booking_at=last_booking_at,
        )
        for user_id, display_name, email, is_active, booking_count, last_booking_at in rows
    ]


def _safe_csv_cell(value: object | None) -> str:
    text = "" if value is None else str(value)
    return f"'{text}" if text.startswith(CSV_FORMULA_PREFIXES) else text


def export_owner_bookings_csv(
    db: Session,
    organization_id: uuid.UUID,
    timezone_name: str,
    owner_user_id: uuid.UUID,
    *,
    status: BookingStatus | None = None,
    service_id: uuid.UUID | None = None,
    staff_profile_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> str:
    bookings = find_owner_bookings(
        db,
        organization_id,
        timezone_name,
        status=status,
        service_id=service_id,
        staff_profile_id=staff_profile_id,
        date_from=date_from,
        date_to=date_to,
    )
    timezone = ZoneInfo(timezone_name)
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(
        [
            "Booking ID",
            "Start time",
            "End time",
            "Timezone",
            "Status",
            "Service name",
            "Staff name",
            "Customer display name",
            "Customer email",
            "Created timestamp",
        ]
    )
    for booking in bookings:
        writer.writerow(
            [
                str(booking.id),
                booking.starts_at.astimezone(timezone).isoformat(),
                booking.ends_at.astimezone(timezone).isoformat(),
                timezone_name,
                booking.status.value,
                _safe_csv_cell(booking.service.name),
                _safe_csv_cell(booking.staff_profile.display_name),
                _safe_csv_cell(booking.customer.display_name),
                _safe_csv_cell(booking.customer.email),
                booking.created_at.astimezone(timezone).isoformat(),
            ]
        )
    record_audit(
        db,
        organization_id,
        owner_user_id,
        AuditAction.CSV_EXPORT_REQUESTED,
        "booking",
        None,
        {
            "row_count": len(bookings),
            "status": status.value if status else None,
            "service_id": str(service_id) if service_id else None,
            "staff_profile_id": str(staff_profile_id) if staff_profile_id else None,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
        },
    )
    db.commit()
    return output.getvalue()
