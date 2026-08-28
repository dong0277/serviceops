import uuid
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.domain_schemas import (
    AvailabilityRuleCreate,
    SlotResponse,
    StaffProfileCreate,
    StaffProfileResponse,
    StaffProfileUpdate,
    TimeOffCreate,
)
from app.errors import ApiError
from app.models import (
    AvailabilityRule,
    Booking,
    BookingStatus,
    Membership,
    MembershipRole,
    Service,
    StaffProfile,
    StaffService,
    TimeOff,
)
from app.services.audit import AuditAction, record_audit

SLOT_INTERVAL_MINUTES = 30
MAX_SLOT_RANGE_DAYS = 31


def _organization_timezone(timezone_name: str) -> ZoneInfo:
    try:
        return ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError as exc:
        raise ApiError(
            422,
            "invalid_organization_timezone",
            "The organization timezone is not supported.",
        ) from exc


def _get_staff_profile(
    db: Session,
    organization_id: uuid.UUID,
    staff_profile_id: uuid.UUID,
    *,
    active_only: bool = False,
) -> StaffProfile:
    statement = (
        select(StaffProfile)
        .options(selectinload(StaffProfile.staff_services))
        .where(
            StaffProfile.id == staff_profile_id,
            StaffProfile.organization_id == organization_id,
        )
    )
    if active_only:
        statement = statement.where(StaffProfile.is_active.is_(True))
    staff = db.scalar(statement)
    if staff is None:
        raise ApiError(404, "staff_not_found", "The staff profile was not found.")
    return staff


def _validate_service_ids(
    db: Session,
    organization_id: uuid.UUID,
    service_ids: list[uuid.UUID],
) -> list[Service]:
    unique_ids = set(service_ids)
    services = list(
        db.scalars(
            select(Service).where(
                Service.organization_id == organization_id,
                Service.id.in_(unique_ids),
            )
        )
    )
    if len(services) != len(unique_ids):
        raise ApiError(422, "invalid_service_assignment", "One or more services are invalid.")
    return services


def _staff_response(staff: StaffProfile) -> StaffProfileResponse:
    return StaffProfileResponse(
        id=staff.id,
        user_id=staff.user_id,
        email=staff.user.email,
        display_name=staff.display_name,
        is_active=staff.is_active,
        service_ids=sorted((assignment.service_id for assignment in staff.staff_services), key=str),
    )


def list_staff(db: Session, organization_id: uuid.UUID) -> list[StaffProfileResponse]:
    staff_profiles = db.scalars(
        select(StaffProfile)
        .options(selectinload(StaffProfile.staff_services), selectinload(StaffProfile.user))
        .where(StaffProfile.organization_id == organization_id)
        .order_by(StaffProfile.display_name, StaffProfile.id)
    )
    return [_staff_response(staff) for staff in staff_profiles]


def create_staff_profile(
    db: Session,
    organization_id: uuid.UUID,
    payload: StaffProfileCreate,
    *,
    actor_user_id: uuid.UUID,
) -> StaffProfileResponse:
    membership = db.scalar(
        select(Membership).where(
            Membership.organization_id == organization_id,
            Membership.user_id == payload.user_id,
            Membership.role == MembershipRole.STAFF,
        )
    )
    if membership is None:
        raise ApiError(422, "invalid_staff_member", "The user is not staff in this organization.")
    existing = db.scalar(
        select(StaffProfile.id).where(
            StaffProfile.organization_id == organization_id,
            StaffProfile.user_id == payload.user_id,
        )
    )
    if existing is not None:
        raise ApiError(409, "staff_profile_exists", "A staff profile already exists.")
    services = _validate_service_ids(db, organization_id, payload.service_ids)
    staff = StaffProfile(
        organization_id=organization_id,
        user_id=payload.user_id,
        display_name=payload.display_name,
    )
    db.add(staff)
    db.flush()
    staff.staff_services = [StaffService(service_id=service.id) for service in services]
    staff.user = membership.user
    record_audit(
        db,
        organization_id,
        actor_user_id,
        AuditAction.STAFF_ADDED,
        "staff_profile",
        staff.id,
        {"service_count": len(services)},
    )
    db.commit()
    return _staff_response(staff)


def update_staff_profile(
    db: Session,
    organization_id: uuid.UUID,
    staff_profile_id: uuid.UUID,
    payload: StaffProfileUpdate,
    *,
    actor_user_id: uuid.UUID,
) -> StaffProfileResponse:
    staff = _get_staff_profile(db, organization_id, staff_profile_id)
    if payload.display_name is not None:
        staff.display_name = payload.display_name
    if payload.is_active is not None:
        staff.is_active = payload.is_active
    if payload.service_ids is not None:
        services = _validate_service_ids(db, organization_id, payload.service_ids)
        staff.staff_services.clear()
        db.flush()
        staff.staff_services.extend(StaffService(service_id=service.id) for service in services)
    action = (
        AuditAction.STAFF_DEACTIVATED if payload.is_active is False else AuditAction.STAFF_UPDATED
    )
    record_audit(
        db,
        organization_id,
        actor_user_id,
        action,
        "staff_profile",
        staff.id,
        {"changed_fields": sorted(payload.model_fields_set)},
    )
    db.commit()
    return _staff_response(staff)


def create_availability_rule(
    db: Session,
    organization_id: uuid.UUID,
    staff_profile_id: uuid.UUID,
    payload: AvailabilityRuleCreate,
) -> AvailabilityRule:
    _get_staff_profile(db, organization_id, staff_profile_id)
    rule = AvailabilityRule(
        organization_id=organization_id,
        staff_profile_id=staff_profile_id,
        **payload.model_dump(),
    )
    db.add(rule)
    db.commit()
    return rule


def list_availability_rules(
    db: Session,
    organization_id: uuid.UUID,
    staff_profile_id: uuid.UUID,
) -> list[AvailabilityRule]:
    _get_staff_profile(db, organization_id, staff_profile_id)
    return list(
        db.scalars(
            select(AvailabilityRule)
            .where(
                AvailabilityRule.organization_id == organization_id,
                AvailabilityRule.staff_profile_id == staff_profile_id,
            )
            .order_by(
                AvailabilityRule.weekday,
                AvailabilityRule.start_local_time,
                AvailabilityRule.id,
            )
        )
    )


def delete_availability_rule(
    db: Session,
    organization_id: uuid.UUID,
    staff_profile_id: uuid.UUID,
    rule_id: uuid.UUID,
) -> None:
    rule = db.scalar(
        select(AvailabilityRule.id).where(
            AvailabilityRule.id == rule_id,
            AvailabilityRule.organization_id == organization_id,
            AvailabilityRule.staff_profile_id == staff_profile_id,
        )
    )
    if rule is None:
        raise ApiError(404, "availability_rule_not_found", "The availability rule was not found.")
    db.execute(delete(AvailabilityRule).where(AvailabilityRule.id == rule_id))
    db.commit()


def create_time_off(
    db: Session,
    organization_id: uuid.UUID,
    staff_profile_id: uuid.UUID,
    payload: TimeOffCreate,
) -> TimeOff:
    _get_staff_profile(db, organization_id, staff_profile_id)
    time_off = TimeOff(
        organization_id=organization_id,
        staff_profile_id=staff_profile_id,
        **payload.model_dump(),
    )
    db.add(time_off)
    db.commit()
    return time_off


def list_time_off(
    db: Session,
    organization_id: uuid.UUID,
    staff_profile_id: uuid.UUID,
) -> list[TimeOff]:
    _get_staff_profile(db, organization_id, staff_profile_id)
    return list(
        db.scalars(
            select(TimeOff)
            .where(
                TimeOff.organization_id == organization_id,
                TimeOff.staff_profile_id == staff_profile_id,
            )
            .order_by(TimeOff.starts_at, TimeOff.id)
        )
    )


def delete_time_off(
    db: Session,
    organization_id: uuid.UUID,
    staff_profile_id: uuid.UUID,
    time_off_id: uuid.UUID,
) -> None:
    entry = db.scalar(
        select(TimeOff.id).where(
            TimeOff.id == time_off_id,
            TimeOff.organization_id == organization_id,
            TimeOff.staff_profile_id == staff_profile_id,
        )
    )
    if entry is None:
        raise ApiError(404, "time_off_not_found", "The time off entry was not found.")
    db.execute(delete(TimeOff).where(TimeOff.id == time_off_id))
    db.commit()


def _date_range(date_from: date, date_to: date) -> list[date]:
    if date_to < date_from:
        raise ApiError(422, "invalid_date_range", "date_to must be on or after date_from.")
    day_count = (date_to - date_from).days + 1
    if day_count > MAX_SLOT_RANGE_DAYS:
        raise ApiError(422, "date_range_too_large", "The date range cannot exceed 31 days.")
    return [date_from + timedelta(days=offset) for offset in range(day_count)]


def _overlaps(
    starts_at: datetime, ends_at: datetime, ranges: list[tuple[datetime, datetime]]
) -> bool:
    return any(range_start < ends_at and range_end > starts_at for range_start, range_end in ranges)


def list_available_slots(
    db: Session,
    organization_id: uuid.UUID,
    timezone_name: str,
    service: Service,
    date_from: date,
    date_to: date,
    *,
    now: datetime | None = None,
) -> list[SlotResponse]:
    dates = _date_range(date_from, date_to)
    timezone = _organization_timezone(timezone_name)
    utc_now = (now or datetime.now(UTC)).astimezone(UTC)
    range_start = datetime.combine(dates[0], time.min, timezone).astimezone(UTC)
    range_end = datetime.combine(dates[-1] + timedelta(days=1), time.min, timezone).astimezone(UTC)

    staff_profiles = list(
        db.scalars(
            select(StaffProfile)
            .join(StaffService)
            .where(
                StaffProfile.organization_id == organization_id,
                StaffProfile.is_active.is_(True),
                StaffService.service_id == service.id,
            )
            .order_by(StaffProfile.display_name, StaffProfile.id)
        )
    )
    if not staff_profiles:
        return []
    staff_ids = [staff.id for staff in staff_profiles]
    rules = list(
        db.scalars(
            select(AvailabilityRule).where(
                AvailabilityRule.organization_id == organization_id,
                AvailabilityRule.staff_profile_id.in_(staff_ids),
                AvailabilityRule.weekday.in_({day.weekday() for day in dates}),
            )
        )
    )
    time_off_rows = list(
        db.scalars(
            select(TimeOff).where(
                TimeOff.organization_id == organization_id,
                TimeOff.staff_profile_id.in_(staff_ids),
                TimeOff.starts_at < range_end,
                TimeOff.ends_at > range_start,
            )
        )
    )
    booking_rows = list(
        db.scalars(
            select(Booking).where(
                Booking.organization_id == organization_id,
                Booking.staff_profile_id.in_(staff_ids),
                Booking.status != BookingStatus.CANCELLED,
                Booking.starts_at < range_end,
                Booking.ends_at > range_start,
            )
        )
    )
    ranges_by_staff: dict[uuid.UUID, list[tuple[datetime, datetime]]] = {
        staff_id: [] for staff_id in staff_ids
    }
    for entry in time_off_rows:
        ranges_by_staff[entry.staff_profile_id].append((entry.starts_at, entry.ends_at))
    for booking in booking_rows:
        ranges_by_staff[booking.staff_profile_id].append((booking.starts_at, booking.ends_at))

    rules_by_staff_day: dict[tuple[uuid.UUID, int], list[AvailabilityRule]] = {}
    for rule in rules:
        rules_by_staff_day.setdefault((rule.staff_profile_id, rule.weekday), []).append(rule)

    duration = timedelta(minutes=service.duration_minutes)
    interval = timedelta(minutes=SLOT_INTERVAL_MINUTES)
    slots: list[SlotResponse] = []
    for day in dates:
        for staff in staff_profiles:
            for rule in rules_by_staff_day.get((staff.id, day.weekday()), []):
                local_start = datetime.combine(day, rule.start_local_time, timezone)
                local_end = datetime.combine(day, rule.end_local_time, timezone)
                candidate = local_start.astimezone(UTC)
                availability_end = local_end.astimezone(UTC)
                while candidate + duration <= availability_end:
                    candidate_end = candidate + duration
                    if candidate > utc_now and not _overlaps(
                        candidate, candidate_end, ranges_by_staff[staff.id]
                    ):
                        slots.append(
                            SlotResponse(
                                staff_profile_id=staff.id,
                                staff_display_name=staff.display_name,
                                starts_at=candidate,
                                ends_at=candidate_end,
                            )
                        )
                    candidate += interval
    return sorted(
        slots, key=lambda slot: (slot.starts_at, slot.staff_display_name, slot.staff_profile_id)
    )


def validate_booking_availability(
    db: Session,
    organization_id: uuid.UUID,
    timezone_name: str,
    service: Service,
    staff_profile_id: uuid.UUID,
    starts_at: datetime,
    *,
    now: datetime | None = None,
) -> tuple[StaffProfile, datetime]:
    staff = _get_staff_profile(db, organization_id, staff_profile_id, active_only=True)
    assignment = db.scalar(
        select(StaffService).where(
            StaffService.staff_profile_id == staff.id,
            StaffService.service_id == service.id,
        )
    )
    if assignment is None:
        raise ApiError(
            422, "staff_service_mismatch", "The staff member does not offer this service."
        )
    utc_start = starts_at.astimezone(UTC)
    utc_now = (now or datetime.now(UTC)).astimezone(UTC)
    if utc_start <= utc_now:
        raise ApiError(422, "booking_in_past", "Bookings must start in the future.")
    utc_end = utc_start + timedelta(minutes=service.duration_minutes)
    timezone = _organization_timezone(timezone_name)
    local_start = utc_start.astimezone(timezone)
    local_end = utc_end.astimezone(timezone)
    if local_start.date() != local_end.date():
        raise ApiError(422, "outside_availability", "The booking is outside staff availability.")
    matching_rule = db.scalar(
        select(AvailabilityRule.id).where(
            AvailabilityRule.organization_id == organization_id,
            AvailabilityRule.staff_profile_id == staff.id,
            AvailabilityRule.weekday == local_start.weekday(),
            AvailabilityRule.start_local_time <= local_start.timetz().replace(tzinfo=None),
            AvailabilityRule.end_local_time >= local_end.timetz().replace(tzinfo=None),
        )
    )
    if matching_rule is None:
        raise ApiError(422, "outside_availability", "The booking is outside staff availability.")
    blocked = db.scalar(
        select(TimeOff.id).where(
            TimeOff.organization_id == organization_id,
            TimeOff.staff_profile_id == staff.id,
            TimeOff.starts_at < utc_end,
            TimeOff.ends_at > utc_start,
        )
    )
    if blocked is not None:
        raise ApiError(409, "staff_unavailable", "The staff member is unavailable at this time.")
    return staff, utc_end
