import uuid
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.domain_schemas import (
    BookingCreate,
    BookingReschedule,
    BookingServiceSummary,
    BookingStaffSummary,
    BookingStatusHistoryResponse,
    CustomerBookingResponse,
    OwnerBookingDetailResponse,
    OwnerBookingResponse,
    OwnerBookingUpdate,
    StaffBookingDetailResponse,
    StaffBookingResponse,
)
from app.errors import ApiError
from app.models import Booking, BookingStatus, BookingStatusHistory, StaffProfile
from app.services.audit import AuditAction, record_audit
from app.services.availability import validate_booking_availability
from app.services.catalog import get_service

CUSTOMER_CANCELLABLE_STATUSES = {BookingStatus.REQUESTED, BookingStatus.CONFIRMED}
ALLOWED_STATUS_TRANSITIONS: dict[BookingStatus, frozenset[BookingStatus]] = {
    BookingStatus.REQUESTED: frozenset({BookingStatus.CONFIRMED, BookingStatus.CANCELLED}),
    BookingStatus.CONFIRMED: frozenset({BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED}),
    BookingStatus.IN_PROGRESS: frozenset({BookingStatus.COMPLETED}),
    BookingStatus.COMPLETED: frozenset(),
    BookingStatus.CANCELLED: frozenset(),
}


def _is_overlap_conflict(exc: IntegrityError) -> bool:
    diagnostic = getattr(exc.orig, "diag", None)
    return getattr(diagnostic, "constraint_name", None) == "excl_bookings_staff_active_overlap"


def _raise_write_error(db: Session, exc: IntegrityError) -> None:
    db.rollback()
    if _is_overlap_conflict(exc):
        raise ApiError(
            409,
            "booking_conflict",
            "That time was just booked. Choose another available slot.",
        ) from exc
    raise exc


def to_customer_response(booking: Booking) -> CustomerBookingResponse:
    return CustomerBookingResponse(
        id=booking.id,
        starts_at=booking.starts_at,
        ends_at=booking.ends_at,
        status=booking.status,
        customer_note=booking.customer_note,
        cancelled_at=booking.cancelled_at,
        created_at=booking.created_at,
        updated_at=booking.updated_at,
        service=BookingServiceSummary(
            id=booking.service.id,
            name=booking.service.name,
            duration_minutes=booking.service.duration_minutes,
            price_display_cents=booking.service.price_display_cents,
        ),
        staff=BookingStaffSummary(
            id=booking.staff_profile.id,
            display_name=booking.staff_profile.display_name,
        ),
    )


def to_owner_response(booking: Booking) -> OwnerBookingResponse:
    customer_response = to_customer_response(booking)
    return OwnerBookingResponse(
        **customer_response.model_dump(),
        customer_user_id=booking.customer_user_id,
        customer_display_name=booking.customer.display_name,
        customer_email=booking.customer.email,
        internal_note=booking.internal_note,
    )


def to_staff_response(booking: Booking) -> StaffBookingResponse:
    customer_response = to_customer_response(booking)
    return StaffBookingResponse(
        **customer_response.model_dump(),
        customer_display_name=booking.customer.display_name,
        internal_note=booking.internal_note,
    )


def _status_history_response(entry: BookingStatusHistory) -> BookingStatusHistoryResponse:
    return BookingStatusHistoryResponse(
        id=entry.id,
        previous_status=entry.previous_status,
        new_status=entry.new_status,
        changed_by_user_id=entry.changed_by_user_id,
        changed_by_display_name=entry.changed_by.display_name,
        changed_at=entry.changed_at,
    )


def to_staff_detail_response(booking: Booking) -> StaffBookingDetailResponse:
    return StaffBookingDetailResponse(
        **to_staff_response(booking).model_dump(),
        status_history=[
            _status_history_response(entry)
            for entry in sorted(booking.status_history, key=lambda item: (item.changed_at, item.id))
        ],
    )


def to_owner_detail_response(booking: Booking) -> OwnerBookingDetailResponse:
    return OwnerBookingDetailResponse(
        **to_owner_response(booking).model_dump(),
        status_history=[
            _status_history_response(entry)
            for entry in sorted(booking.status_history, key=lambda item: (item.changed_at, item.id))
        ],
    )


def _load_operational_booking(
    db: Session,
    organization_id: uuid.UUID,
    booking_id: uuid.UUID,
    *,
    staff_profile_id: uuid.UUID | None = None,
    for_update: bool = False,
) -> Booking:
    statement = (
        select(Booking)
        .options(
            selectinload(Booking.service),
            selectinload(Booking.staff_profile),
            selectinload(Booking.customer),
            selectinload(Booking.status_history).selectinload(BookingStatusHistory.changed_by),
        )
        .where(
            Booking.id == booking_id,
            Booking.organization_id == organization_id,
        )
    )
    if staff_profile_id is not None:
        statement = statement.where(Booking.staff_profile_id == staff_profile_id)
    if for_update:
        statement = statement.with_for_update(of=Booking)
    booking = db.scalar(statement)
    if booking is None:
        raise ApiError(404, "booking_not_found", "The booking was not found.")
    return booking


def _staff_profile_id_for_user(
    db: Session,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
) -> uuid.UUID:
    staff_profile_id = db.scalar(
        select(StaffProfile.id).where(
            StaffProfile.organization_id == organization_id,
            StaffProfile.user_id == user_id,
            StaffProfile.is_active.is_(True),
        )
    )
    if staff_profile_id is None:
        raise ApiError(404, "staff_profile_not_found", "An active staff profile was not found.")
    return staff_profile_id


def _load_customer_booking(
    db: Session,
    organization_id: uuid.UUID,
    customer_user_id: uuid.UUID,
    booking_id: uuid.UUID,
    *,
    for_update: bool = False,
) -> Booking:
    statement = (
        select(Booking)
        .options(
            selectinload(Booking.service),
            selectinload(Booking.staff_profile),
            selectinload(Booking.customer),
        )
        .where(
            Booking.id == booking_id,
            Booking.organization_id == organization_id,
            Booking.customer_user_id == customer_user_id,
        )
    )
    if for_update:
        statement = statement.with_for_update(of=Booking)
    booking = db.scalar(statement)
    if booking is None:
        raise ApiError(404, "booking_not_found", "The booking was not found.")
    return booking


def create_booking(
    db: Session,
    organization_id: uuid.UUID,
    timezone_name: str,
    customer_user_id: uuid.UUID,
    payload: BookingCreate,
) -> CustomerBookingResponse:
    service = get_service(db, organization_id, payload.service_id, active_only=True)
    staff, ends_at = validate_booking_availability(
        db,
        organization_id,
        timezone_name,
        service,
        payload.staff_profile_id,
        payload.starts_at,
    )
    note = payload.customer_note.strip() if payload.customer_note else None
    booking = Booking(
        organization_id=organization_id,
        customer_user_id=customer_user_id,
        staff_profile_id=staff.id,
        service_id=service.id,
        starts_at=payload.starts_at,
        ends_at=ends_at,
        status=BookingStatus.REQUESTED,
        customer_note=note or None,
    )
    db.add(booking)
    try:
        db.flush()
        db.add(
            BookingStatusHistory(
                booking_id=booking.id,
                previous_status=None,
                new_status=BookingStatus.REQUESTED,
                changed_by_user_id=customer_user_id,
            )
        )
        record_audit(
            db,
            organization_id,
            customer_user_id,
            AuditAction.BOOKING_CREATED,
            "booking",
            booking.id,
            {
                "service_id": str(service.id),
                "staff_profile_id": str(staff.id),
                "starts_at": payload.starts_at.isoformat(),
            },
        )
        db.commit()
    except IntegrityError as exc:
        _raise_write_error(db, exc)
    booking.service = service
    booking.staff_profile = staff
    return to_customer_response(booking)


def list_customer_bookings(
    db: Session,
    organization_id: uuid.UUID,
    customer_user_id: uuid.UUID,
) -> list[CustomerBookingResponse]:
    bookings = db.scalars(
        select(Booking)
        .options(
            selectinload(Booking.service),
            selectinload(Booking.staff_profile),
            selectinload(Booking.customer),
        )
        .where(
            Booking.organization_id == organization_id,
            Booking.customer_user_id == customer_user_id,
        )
        .order_by(Booking.starts_at.desc(), Booking.id)
    )
    return [to_customer_response(booking) for booking in bookings]


def get_customer_booking(
    db: Session,
    organization_id: uuid.UUID,
    customer_user_id: uuid.UUID,
    booking_id: uuid.UUID,
) -> CustomerBookingResponse:
    return to_customer_response(
        _load_customer_booking(db, organization_id, customer_user_id, booking_id)
    )


def reschedule_booking(
    db: Session,
    organization_id: uuid.UUID,
    timezone_name: str,
    customer_user_id: uuid.UUID,
    booking_id: uuid.UUID,
    payload: BookingReschedule,
) -> CustomerBookingResponse:
    booking = _load_customer_booking(
        db,
        organization_id,
        customer_user_id,
        booking_id,
        for_update=True,
    )
    if booking.status not in CUSTOMER_CANCELLABLE_STATUSES:
        raise ApiError(409, "booking_not_reschedulable", "This booking cannot be rescheduled.")
    previous_staff_profile_id = booking.staff_profile_id
    previous_starts_at = booking.starts_at
    staff, ends_at = validate_booking_availability(
        db,
        organization_id,
        timezone_name,
        booking.service,
        payload.staff_profile_id,
        payload.starts_at,
    )
    booking.staff_profile_id = staff.id
    booking.starts_at = payload.starts_at
    booking.ends_at = ends_at
    record_audit(
        db,
        organization_id,
        customer_user_id,
        AuditAction.BOOKING_RESCHEDULED,
        "booking",
        booking.id,
        {
            "previous_starts_at": previous_starts_at.isoformat(),
            "new_starts_at": payload.starts_at.isoformat(),
            "previous_staff_profile_id": str(previous_staff_profile_id),
            "new_staff_profile_id": str(staff.id),
        },
    )
    try:
        db.commit()
    except IntegrityError as exc:
        _raise_write_error(db, exc)
    booking.staff_profile = staff
    return to_customer_response(booking)


def cancel_booking(
    db: Session,
    organization_id: uuid.UUID,
    customer_user_id: uuid.UUID,
    booking_id: uuid.UUID,
) -> CustomerBookingResponse:
    booking = _load_customer_booking(
        db,
        organization_id,
        customer_user_id,
        booking_id,
        for_update=True,
    )
    if booking.status not in CUSTOMER_CANCELLABLE_STATUSES:
        raise ApiError(409, "booking_not_cancellable", "This booking cannot be cancelled.")
    previous_status = booking.status
    booking.status = BookingStatus.CANCELLED
    booking.cancelled_at = datetime.now(UTC)
    db.add(
        BookingStatusHistory(
            booking_id=booking.id,
            previous_status=previous_status,
            new_status=BookingStatus.CANCELLED,
            changed_by_user_id=customer_user_id,
        )
    )
    record_audit(
        db,
        organization_id,
        customer_user_id,
        AuditAction.BOOKING_CANCELLED,
        "booking",
        booking.id,
        {"previous_status": previous_status.value},
    )
    db.commit()
    return to_customer_response(booking)


def find_owner_bookings(
    db: Session,
    organization_id: uuid.UUID,
    timezone_name: str,
    *,
    status: BookingStatus | None = None,
    service_id: uuid.UUID | None = None,
    staff_profile_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[Booking]:
    if date_from is not None and date_to is not None and date_to < date_from:
        raise ApiError(422, "invalid_date_range", "date_to must be on or after date_from.")
    statement = (
        select(Booking)
        .options(
            selectinload(Booking.service),
            selectinload(Booking.staff_profile),
            selectinload(Booking.customer),
        )
        .where(Booking.organization_id == organization_id)
    )
    if status is not None:
        statement = statement.where(Booking.status == status)
    if service_id is not None:
        statement = statement.where(Booking.service_id == service_id)
    if staff_profile_id is not None:
        statement = statement.where(Booking.staff_profile_id == staff_profile_id)
    timezone = ZoneInfo(timezone_name)
    if date_from is not None:
        start = datetime.combine(date_from, time.min, timezone).astimezone(UTC)
        statement = statement.where(Booking.starts_at >= start)
    if date_to is not None:
        end = datetime.combine(date_to + timedelta(days=1), time.min, timezone).astimezone(UTC)
        statement = statement.where(Booking.starts_at < end)
    return list(db.scalars(statement.order_by(Booking.starts_at.desc(), Booking.id)))


def list_owner_bookings(
    db: Session,
    organization_id: uuid.UUID,
    timezone_name: str,
    *,
    status: BookingStatus | None = None,
    service_id: uuid.UUID | None = None,
    staff_profile_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[OwnerBookingResponse]:
    return [
        to_owner_response(booking)
        for booking in find_owner_bookings(
            db,
            organization_id,
            timezone_name,
            status=status,
            service_id=service_id,
            staff_profile_id=staff_profile_id,
            date_from=date_from,
            date_to=date_to,
        )
    ]


def list_staff_bookings(
    db: Session,
    organization_id: uuid.UUID,
    staff_user_id: uuid.UUID,
    *,
    status: BookingStatus | None = None,
) -> list[StaffBookingResponse]:
    staff_profile_id = _staff_profile_id_for_user(db, organization_id, staff_user_id)
    statement = (
        select(Booking)
        .options(
            selectinload(Booking.service),
            selectinload(Booking.staff_profile),
            selectinload(Booking.customer),
        )
        .where(
            Booking.organization_id == organization_id,
            Booking.staff_profile_id == staff_profile_id,
        )
    )
    if status is not None:
        statement = statement.where(Booking.status == status)
    bookings = db.scalars(statement.order_by(Booking.starts_at.desc(), Booking.id))
    return [to_staff_response(booking) for booking in bookings]


def get_staff_booking(
    db: Session,
    organization_id: uuid.UUID,
    staff_user_id: uuid.UUID,
    booking_id: uuid.UUID,
) -> StaffBookingDetailResponse:
    staff_profile_id = _staff_profile_id_for_user(db, organization_id, staff_user_id)
    booking = _load_operational_booking(
        db,
        organization_id,
        booking_id,
        staff_profile_id=staff_profile_id,
    )
    return to_staff_detail_response(booking)


def get_owner_booking(
    db: Session,
    organization_id: uuid.UUID,
    booking_id: uuid.UUID,
) -> OwnerBookingDetailResponse:
    return to_owner_detail_response(_load_operational_booking(db, organization_id, booking_id))


def _transition_booking(
    db: Session,
    booking: Booking,
    actor_user_id: uuid.UUID,
    new_status: BookingStatus,
) -> None:
    previous_status = booking.status
    if new_status not in ALLOWED_STATUS_TRANSITIONS[previous_status]:
        raise ApiError(
            409,
            "invalid_status_transition",
            f"Cannot change booking status from {previous_status.value} to {new_status.value}.",
        )
    booking.status = new_status
    if new_status == BookingStatus.CANCELLED:
        booking.cancelled_at = datetime.now(UTC)
    history = BookingStatusHistory(
        booking=booking,
        previous_status=previous_status,
        new_status=new_status,
        changed_by_user_id=actor_user_id,
    )
    db.add(history)
    record_audit(
        db,
        booking.organization_id,
        actor_user_id,
        (
            AuditAction.BOOKING_CANCELLED
            if new_status == BookingStatus.CANCELLED
            else AuditAction.BOOKING_STATUS_CHANGED
        ),
        "booking",
        booking.id,
        {"previous_status": previous_status.value, "new_status": new_status.value},
    )
    db.commit()


def transition_staff_booking(
    db: Session,
    organization_id: uuid.UUID,
    staff_user_id: uuid.UUID,
    booking_id: uuid.UUID,
    new_status: BookingStatus,
) -> StaffBookingDetailResponse:
    staff_profile_id = _staff_profile_id_for_user(db, organization_id, staff_user_id)
    booking = _load_operational_booking(
        db,
        organization_id,
        booking_id,
        staff_profile_id=staff_profile_id,
        for_update=True,
    )
    _transition_booking(db, booking, staff_user_id, new_status)
    return to_staff_detail_response(booking)


def transition_owner_booking(
    db: Session,
    organization_id: uuid.UUID,
    owner_user_id: uuid.UUID,
    booking_id: uuid.UUID,
    new_status: BookingStatus,
) -> OwnerBookingDetailResponse:
    booking = _load_operational_booking(db, organization_id, booking_id, for_update=True)
    _transition_booking(db, booking, owner_user_id, new_status)
    return to_owner_detail_response(booking)


def update_owner_booking(
    db: Session,
    organization_id: uuid.UUID,
    timezone_name: str,
    owner_user_id: uuid.UUID,
    booking_id: uuid.UUID,
    payload: OwnerBookingUpdate,
) -> OwnerBookingDetailResponse:
    if not payload.model_fields_set:
        raise ApiError(422, "empty_update", "At least one booking field must be provided.")
    booking = _load_operational_booking(db, organization_id, booking_id, for_update=True)
    if "staff_profile_id" in payload.model_fields_set:
        if payload.staff_profile_id is None:
            raise ApiError(422, "staff_required", "A staff profile is required.")
        if payload.staff_profile_id != booking.staff_profile_id:
            if booking.status not in CUSTOMER_CANCELLABLE_STATUSES:
                raise ApiError(
                    409,
                    "booking_not_reassignable",
                    "Only requested or confirmed bookings can be reassigned.",
                )
            previous_staff_profile_id = booking.staff_profile_id
            staff, ends_at = validate_booking_availability(
                db,
                organization_id,
                timezone_name,
                booking.service,
                payload.staff_profile_id,
                booking.starts_at,
            )
            booking.staff_profile_id = staff.id
            booking.staff_profile = staff
            booking.ends_at = ends_at
            record_audit(
                db,
                organization_id,
                owner_user_id,
                AuditAction.STAFF_ASSIGNMENT_CHANGED,
                "booking",
                booking.id,
                {
                    "previous_staff_profile_id": str(previous_staff_profile_id),
                    "new_staff_profile_id": str(staff.id),
                },
            )
    if "internal_note" in payload.model_fields_set:
        note = payload.internal_note.strip() if payload.internal_note else None
        booking.internal_note = note or None
        record_audit(
            db,
            organization_id,
            owner_user_id,
            AuditAction.BOOKING_INTERNAL_NOTE_UPDATED,
            "booking",
            booking.id,
        )
    try:
        db.commit()
    except IntegrityError as exc:
        _raise_write_error(db, exc)
    return to_owner_detail_response(booking)
