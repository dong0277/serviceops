import uuid
from datetime import UTC, date, datetime, time
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models import BookingStatus


def _clean_required(value: str) -> str:
    cleaned = " ".join(value.split())
    if not cleaned:
        raise ValueError("The value cannot be empty.")
    return cleaned


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("A timezone offset is required.")
    return value.astimezone(UTC)


class ServiceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    duration_minutes: int = Field(ge=15, le=24 * 60)
    price_display_cents: int | None = Field(default=None, ge=0, le=100_000_000)
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        return _clean_required(value)


class ServiceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    duration_minutes: int | None = Field(default=None, ge=15, le=24 * 60)
    price_display_cents: int | None = Field(default=None, ge=0, le=100_000_000)
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        return _clean_required(value) if value is not None else None


class ServiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str
    duration_minutes: int
    price_display_cents: int | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class StaffProfileCreate(BaseModel):
    user_id: uuid.UUID
    display_name: str = Field(min_length=1, max_length=100)
    service_ids: list[uuid.UUID] = Field(default_factory=list, max_length=50)

    @field_validator("display_name")
    @classmethod
    def clean_display_name(cls, value: str) -> str:
        return _clean_required(value)


class StaffProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=100)
    is_active: bool | None = None
    service_ids: list[uuid.UUID] | None = Field(default=None, max_length=50)

    @field_validator("display_name")
    @classmethod
    def clean_display_name(cls, value: str | None) -> str | None:
        return _clean_required(value) if value is not None else None


class StaffProfileResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    email: str
    display_name: str
    is_active: bool
    service_ids: list[uuid.UUID]


class AvailabilityRuleCreate(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start_local_time: time
    end_local_time: time

    @model_validator(mode="after")
    def validate_order(self) -> "AvailabilityRuleCreate":
        if self.start_local_time >= self.end_local_time:
            raise ValueError("start_local_time must be before end_local_time.")
        return self


class AvailabilityRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    staff_profile_id: uuid.UUID
    weekday: int
    start_local_time: time
    end_local_time: time


class TimeOffCreate(BaseModel):
    starts_at: datetime
    ends_at: datetime
    reason: str | None = Field(default=None, max_length=240)

    @field_validator("starts_at", "ends_at")
    @classmethod
    def normalize_datetime(cls, value: datetime) -> datetime:
        return _as_utc(value)

    @model_validator(mode="after")
    def validate_order(self) -> "TimeOffCreate":
        if self.starts_at >= self.ends_at:
            raise ValueError("starts_at must be before ends_at.")
        return self


class TimeOffResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    staff_profile_id: uuid.UUID
    starts_at: datetime
    ends_at: datetime
    reason: str | None


class SlotResponse(BaseModel):
    staff_profile_id: uuid.UUID
    staff_display_name: str
    starts_at: datetime
    ends_at: datetime


class BookingCreate(BaseModel):
    service_id: uuid.UUID
    staff_profile_id: uuid.UUID
    starts_at: datetime
    customer_note: str | None = Field(default=None, max_length=1000)

    @field_validator("starts_at")
    @classmethod
    def normalize_start(cls, value: datetime) -> datetime:
        return _as_utc(value)


class BookingReschedule(BaseModel):
    staff_profile_id: uuid.UUID
    starts_at: datetime

    @field_validator("starts_at")
    @classmethod
    def normalize_start(cls, value: datetime) -> datetime:
        return _as_utc(value)


class BookingServiceSummary(BaseModel):
    id: uuid.UUID
    name: str
    duration_minutes: int
    price_display_cents: int | None


class BookingStaffSummary(BaseModel):
    id: uuid.UUID
    display_name: str


class CustomerBookingResponse(BaseModel):
    id: uuid.UUID
    starts_at: datetime
    ends_at: datetime
    status: BookingStatus
    customer_note: str | None
    cancelled_at: datetime | None
    created_at: datetime
    updated_at: datetime
    service: BookingServiceSummary
    staff: BookingStaffSummary


class OwnerBookingResponse(CustomerBookingResponse):
    customer_user_id: uuid.UUID
    customer_display_name: str
    customer_email: str
    internal_note: str | None


class OwnerBookingSort(StrEnum):
    STARTS_AT_DESC = "starts_at_desc"
    STARTS_AT_ASC = "starts_at_asc"


class OwnerBookingListSummary(BaseModel):
    today_count: int
    requested_count: int
    upcoming_count: int


class OwnerBookingPageResponse(BaseModel):
    items: list[OwnerBookingResponse]
    total: int
    limit: int
    offset: int
    summary: OwnerBookingListSummary


class StaffBookingResponse(CustomerBookingResponse):
    customer_display_name: str
    internal_note: str | None


class BookingStatusUpdate(BaseModel):
    status: BookingStatus


class OwnerBookingUpdate(BaseModel):
    staff_profile_id: uuid.UUID | None = None
    internal_note: str | None = Field(default=None, max_length=2000)


class BookingStatusHistoryResponse(BaseModel):
    id: uuid.UUID
    previous_status: BookingStatus | None
    new_status: BookingStatus
    changed_by_user_id: uuid.UUID
    changed_by_display_name: str
    changed_at: datetime


class StaffBookingDetailResponse(StaffBookingResponse):
    status_history: list[BookingStatusHistoryResponse]


class OwnerBookingDetailResponse(OwnerBookingResponse):
    status_history: list[BookingStatusHistoryResponse]


class OwnerCustomerResponse(BaseModel):
    id: uuid.UUID
    display_name: str
    email: str
    is_active: bool
    booking_count: int
    last_booking_at: datetime | None


class DashboardStatusMetric(BaseModel):
    status: BookingStatus
    count: int


class DashboardServiceMetric(BaseModel):
    service_id: uuid.UUID
    service_name: str
    count: int


class DashboardStaffMetric(BaseModel):
    staff_profile_id: uuid.UUID
    staff_display_name: str
    count: int


class OwnerDashboardResponse(BaseModel):
    timezone: str
    today: date
    period_days: int
    period_start: date
    period_end: date
    today_booking_count: int
    period_booking_count: int
    completion_rate: float
    cancellation_count: int
    requested_count: int
    status_counts: list[DashboardStatusMetric]
    service_counts: list[DashboardServiceMetric]
    staff_workload: list[DashboardStaffMetric]
    today_schedule: list[OwnerBookingResponse]


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    actor_user_id: uuid.UUID | None
    actor_display_name: str | None
    action: str
    entity_type: str
    entity_id: uuid.UUID | None
    metadata_json: dict[str, object]
    created_at: datetime


class BookingListFilters(BaseModel):
    status: BookingStatus | None = None
    service_id: uuid.UUID | None = None
    staff_profile_id: uuid.UUID | None = None
    date_from: date | None = None
    date_to: date | None = None
