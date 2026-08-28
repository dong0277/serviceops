import csv
import io
import uuid
from datetime import date
from zoneinfo import ZoneInfo

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.domain_schemas import OwnerCustomerResponse
from app.models import Booking, BookingStatus, Membership, MembershipRole, User
from app.services.audit import AuditAction, record_audit
from app.services.bookings import find_owner_bookings

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
