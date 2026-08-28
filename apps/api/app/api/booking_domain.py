import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response

from app.api.dependencies import (
    DatabaseSession,
    require_organization_roles,
    require_organization_write_roles,
)
from app.domain_schemas import (
    AuditLogResponse,
    AvailabilityRuleCreate,
    AvailabilityRuleResponse,
    BookingCreate,
    BookingReschedule,
    BookingStatusUpdate,
    CustomerBookingResponse,
    OwnerBookingDetailResponse,
    OwnerBookingResponse,
    OwnerBookingUpdate,
    OwnerCustomerResponse,
    OwnerDashboardResponse,
    ServiceCreate,
    ServiceResponse,
    ServiceUpdate,
    SlotResponse,
    StaffBookingDetailResponse,
    StaffBookingResponse,
    StaffProfileCreate,
    StaffProfileResponse,
    StaffProfileUpdate,
    TimeOffCreate,
    TimeOffResponse,
)
from app.models import BookingStatus, MembershipRole
from app.services.audit import list_audit_logs
from app.services.availability import (
    create_availability_rule,
    create_staff_profile,
    create_time_off,
    delete_availability_rule,
    delete_time_off,
    list_availability_rules,
    list_available_slots,
    list_staff,
    list_time_off,
    update_staff_profile,
)
from app.services.bookings import (
    cancel_booking,
    create_booking,
    get_customer_booking,
    get_owner_booking,
    get_staff_booking,
    list_customer_bookings,
    list_owner_bookings,
    list_staff_bookings,
    reschedule_booking,
    transition_owner_booking,
    transition_staff_booking,
    update_owner_booking,
)
from app.services.catalog import (
    create_service,
    deactivate_service,
    get_organization_by_slug,
    get_service,
    list_services,
    update_service,
)
from app.services.operations import (
    export_owner_bookings_csv,
    get_owner_dashboard,
    list_owner_customers,
)
from app.services.tenancy import OrganizationPrincipal

router = APIRouter(prefix="/api/v1/organizations", tags=["booking domain"])

CustomerPrincipal = Annotated[
    OrganizationPrincipal,
    Depends(require_organization_roles(MembershipRole.CUSTOMER)),
]
CustomerWritePrincipal = Annotated[
    OrganizationPrincipal,
    Depends(require_organization_write_roles(MembershipRole.CUSTOMER)),
]
OwnerPrincipal = Annotated[
    OrganizationPrincipal,
    Depends(require_organization_roles(MembershipRole.OWNER)),
]
OwnerWritePrincipal = Annotated[
    OrganizationPrincipal,
    Depends(require_organization_write_roles(MembershipRole.OWNER)),
]
StaffPrincipal = Annotated[
    OrganizationPrincipal,
    Depends(require_organization_roles(MembershipRole.STAFF)),
]
StaffWritePrincipal = Annotated[
    OrganizationPrincipal,
    Depends(require_organization_write_roles(MembershipRole.STAFF)),
]


@router.get("/{organization_slug}/services", response_model=list[ServiceResponse])
def public_services(organization_slug: str, db: DatabaseSession) -> list[ServiceResponse]:
    organization = get_organization_by_slug(db, organization_slug)
    return [
        ServiceResponse.model_validate(service)
        for service in list_services(db, organization.id, active_only=True)
    ]


@router.get("/{organization_slug}/owner/services", response_model=list[ServiceResponse])
def owner_services(principal: OwnerPrincipal, db: DatabaseSession) -> list[ServiceResponse]:
    return [
        ServiceResponse.model_validate(service)
        for service in list_services(db, principal.organization.id, active_only=False)
    ]


@router.post(
    "/{organization_slug}/owner/services",
    response_model=ServiceResponse,
    status_code=201,
)
def owner_create_service(
    payload: ServiceCreate,
    principal: OwnerWritePrincipal,
    db: DatabaseSession,
) -> ServiceResponse:
    return ServiceResponse.model_validate(
        create_service(
            db,
            principal.organization.id,
            payload,
            actor_user_id=principal.user.id,
        )
    )


@router.patch("/{organization_slug}/owner/services/{service_id}", response_model=ServiceResponse)
def owner_update_service(
    service_id: uuid.UUID,
    payload: ServiceUpdate,
    principal: OwnerWritePrincipal,
    db: DatabaseSession,
) -> ServiceResponse:
    return ServiceResponse.model_validate(
        update_service(
            db,
            principal.organization.id,
            service_id,
            payload,
            actor_user_id=principal.user.id,
        )
    )


@router.delete("/{organization_slug}/owner/services/{service_id}", status_code=204)
def owner_deactivate_service(
    service_id: uuid.UUID,
    principal: OwnerWritePrincipal,
    db: DatabaseSession,
) -> Response:
    deactivate_service(
        db,
        principal.organization.id,
        service_id,
        actor_user_id=principal.user.id,
    )
    return Response(status_code=204)


@router.get("/{organization_slug}/owner/staff", response_model=list[StaffProfileResponse])
def owner_staff(principal: OwnerPrincipal, db: DatabaseSession) -> list[StaffProfileResponse]:
    return list_staff(db, principal.organization.id)


@router.post(
    "/{organization_slug}/owner/staff",
    response_model=StaffProfileResponse,
    status_code=201,
)
def owner_create_staff(
    payload: StaffProfileCreate,
    principal: OwnerWritePrincipal,
    db: DatabaseSession,
) -> StaffProfileResponse:
    return create_staff_profile(
        db,
        principal.organization.id,
        payload,
        actor_user_id=principal.user.id,
    )


@router.patch(
    "/{organization_slug}/owner/staff/{staff_profile_id}",
    response_model=StaffProfileResponse,
)
def owner_update_staff(
    staff_profile_id: uuid.UUID,
    payload: StaffProfileUpdate,
    principal: OwnerWritePrincipal,
    db: DatabaseSession,
) -> StaffProfileResponse:
    return update_staff_profile(
        db,
        principal.organization.id,
        staff_profile_id,
        payload,
        actor_user_id=principal.user.id,
    )


@router.get(
    "/{organization_slug}/owner/staff/{staff_profile_id}/availability",
    response_model=list[AvailabilityRuleResponse],
)
def owner_availability(
    staff_profile_id: uuid.UUID,
    principal: OwnerPrincipal,
    db: DatabaseSession,
) -> list[AvailabilityRuleResponse]:
    return [
        AvailabilityRuleResponse.model_validate(rule)
        for rule in list_availability_rules(db, principal.organization.id, staff_profile_id)
    ]


@router.post(
    "/{organization_slug}/owner/staff/{staff_profile_id}/availability",
    response_model=AvailabilityRuleResponse,
    status_code=201,
)
def owner_create_availability(
    staff_profile_id: uuid.UUID,
    payload: AvailabilityRuleCreate,
    principal: OwnerWritePrincipal,
    db: DatabaseSession,
) -> AvailabilityRuleResponse:
    return AvailabilityRuleResponse.model_validate(
        create_availability_rule(db, principal.organization.id, staff_profile_id, payload)
    )


@router.delete(
    "/{organization_slug}/owner/staff/{staff_profile_id}/availability/{rule_id}",
    status_code=204,
)
def owner_delete_availability(
    staff_profile_id: uuid.UUID,
    rule_id: uuid.UUID,
    principal: OwnerWritePrincipal,
    db: DatabaseSession,
) -> Response:
    delete_availability_rule(db, principal.organization.id, staff_profile_id, rule_id)
    return Response(status_code=204)


@router.get(
    "/{organization_slug}/owner/staff/{staff_profile_id}/time-off",
    response_model=list[TimeOffResponse],
)
def owner_time_off(
    staff_profile_id: uuid.UUID,
    principal: OwnerPrincipal,
    db: DatabaseSession,
) -> list[TimeOffResponse]:
    return [
        TimeOffResponse.model_validate(entry)
        for entry in list_time_off(db, principal.organization.id, staff_profile_id)
    ]


@router.post(
    "/{organization_slug}/owner/staff/{staff_profile_id}/time-off",
    response_model=TimeOffResponse,
    status_code=201,
)
def owner_create_time_off(
    staff_profile_id: uuid.UUID,
    payload: TimeOffCreate,
    principal: OwnerWritePrincipal,
    db: DatabaseSession,
) -> TimeOffResponse:
    return TimeOffResponse.model_validate(
        create_time_off(db, principal.organization.id, staff_profile_id, payload)
    )


@router.delete(
    "/{organization_slug}/owner/staff/{staff_profile_id}/time-off/{time_off_id}",
    status_code=204,
)
def owner_delete_time_off(
    staff_profile_id: uuid.UUID,
    time_off_id: uuid.UUID,
    principal: OwnerWritePrincipal,
    db: DatabaseSession,
) -> Response:
    delete_time_off(db, principal.organization.id, staff_profile_id, time_off_id)
    return Response(status_code=204)


@router.get("/{organization_slug}/slots", response_model=list[SlotResponse])
def available_slots(
    organization_slug: str,
    service_id: uuid.UUID,
    date_from: Annotated[date, Query()],
    date_to: Annotated[date, Query()],
    db: DatabaseSession,
) -> list[SlotResponse]:
    organization = get_organization_by_slug(db, organization_slug)
    service = get_service(db, organization.id, service_id, active_only=True)
    return list_available_slots(
        db,
        organization.id,
        organization.timezone,
        service,
        date_from,
        date_to,
    )


@router.get("/{organization_slug}/owner/bookings", response_model=list[OwnerBookingResponse])
def owner_bookings(
    principal: OwnerPrincipal,
    db: DatabaseSession,
    status: BookingStatus | None = None,
    service_id: uuid.UUID | None = None,
    staff_profile_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[OwnerBookingResponse]:
    return list_owner_bookings(
        db,
        principal.organization.id,
        principal.organization.timezone,
        status=status,
        service_id=service_id,
        staff_profile_id=staff_profile_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get(
    "/{organization_slug}/owner/dashboard",
    response_model=OwnerDashboardResponse,
)
def owner_dashboard(
    principal: OwnerPrincipal,
    db: DatabaseSession,
    period_days: Annotated[int, Query(ge=1, le=90)] = 7,
) -> OwnerDashboardResponse:
    return get_owner_dashboard(
        db,
        principal.organization.id,
        principal.organization.timezone,
        period_days,
    )


@router.get(
    "/{organization_slug}/owner/bookings/export",
    response_class=Response,
)
def owner_export_bookings(
    principal: OwnerPrincipal,
    db: DatabaseSession,
    status: BookingStatus | None = None,
    service_id: uuid.UUID | None = None,
    staff_profile_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> Response:
    content = export_owner_bookings_csv(
        db,
        principal.organization.id,
        principal.organization.timezone,
        principal.user.id,
        status=status,
        service_id=service_id,
        staff_profile_id=staff_profile_id,
        date_from=date_from,
        date_to=date_to,
    )
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="serviceops-bookings.csv"'},
    )


@router.get(
    "/{organization_slug}/owner/bookings/{booking_id}",
    response_model=OwnerBookingDetailResponse,
)
def owner_booking(
    booking_id: uuid.UUID,
    principal: OwnerPrincipal,
    db: DatabaseSession,
) -> OwnerBookingDetailResponse:
    return get_owner_booking(db, principal.organization.id, booking_id)


@router.patch(
    "/{organization_slug}/owner/bookings/{booking_id}",
    response_model=OwnerBookingDetailResponse,
)
def owner_update_booking_details(
    booking_id: uuid.UUID,
    payload: OwnerBookingUpdate,
    principal: OwnerWritePrincipal,
    db: DatabaseSession,
) -> OwnerBookingDetailResponse:
    return update_owner_booking(
        db,
        principal.organization.id,
        principal.organization.timezone,
        principal.user.id,
        booking_id,
        payload,
    )


@router.patch(
    "/{organization_slug}/owner/bookings/{booking_id}/status",
    response_model=OwnerBookingDetailResponse,
)
def owner_update_booking_status(
    booking_id: uuid.UUID,
    payload: BookingStatusUpdate,
    principal: OwnerWritePrincipal,
    db: DatabaseSession,
) -> OwnerBookingDetailResponse:
    return transition_owner_booking(
        db,
        principal.organization.id,
        principal.user.id,
        booking_id,
        payload.status,
    )


@router.get(
    "/{organization_slug}/staff/bookings",
    response_model=list[StaffBookingResponse],
)
def staff_bookings(
    principal: StaffPrincipal,
    db: DatabaseSession,
    status: BookingStatus | None = None,
) -> list[StaffBookingResponse]:
    return list_staff_bookings(
        db,
        principal.organization.id,
        principal.user.id,
        status=status,
    )


@router.get(
    "/{organization_slug}/staff/bookings/{booking_id}",
    response_model=StaffBookingDetailResponse,
)
def staff_booking(
    booking_id: uuid.UUID,
    principal: StaffPrincipal,
    db: DatabaseSession,
) -> StaffBookingDetailResponse:
    return get_staff_booking(db, principal.organization.id, principal.user.id, booking_id)


@router.patch(
    "/{organization_slug}/staff/bookings/{booking_id}/status",
    response_model=StaffBookingDetailResponse,
)
def staff_update_booking_status(
    booking_id: uuid.UUID,
    payload: BookingStatusUpdate,
    principal: StaffWritePrincipal,
    db: DatabaseSession,
) -> StaffBookingDetailResponse:
    return transition_staff_booking(
        db,
        principal.organization.id,
        principal.user.id,
        booking_id,
        payload.status,
    )


@router.get(
    "/{organization_slug}/owner/customers",
    response_model=list[OwnerCustomerResponse],
)
def owner_customers(
    principal: OwnerPrincipal,
    db: DatabaseSession,
) -> list[OwnerCustomerResponse]:
    return list_owner_customers(db, principal.organization.id)


@router.get(
    "/{organization_slug}/owner/audit-logs",
    response_model=list[AuditLogResponse],
)
def owner_audit_logs(
    principal: OwnerPrincipal,
    db: DatabaseSession,
    action: str | None = None,
    entity_type: str | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[AuditLogResponse]:
    return list_audit_logs(
        db,
        principal.organization.id,
        action=action,
        entity_type=entity_type,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/{organization_slug}/bookings",
    response_model=CustomerBookingResponse,
    status_code=201,
)
def customer_create_booking(
    payload: BookingCreate,
    principal: CustomerWritePrincipal,
    db: DatabaseSession,
) -> CustomerBookingResponse:
    return create_booking(
        db,
        principal.organization.id,
        principal.organization.timezone,
        principal.user.id,
        payload,
    )


@router.get("/{organization_slug}/bookings", response_model=list[CustomerBookingResponse])
def customer_bookings(
    principal: CustomerPrincipal,
    db: DatabaseSession,
) -> list[CustomerBookingResponse]:
    return list_customer_bookings(db, principal.organization.id, principal.user.id)


@router.get("/{organization_slug}/bookings/{booking_id}", response_model=CustomerBookingResponse)
def customer_booking(
    booking_id: uuid.UUID,
    principal: CustomerPrincipal,
    db: DatabaseSession,
) -> CustomerBookingResponse:
    return get_customer_booking(db, principal.organization.id, principal.user.id, booking_id)


@router.patch("/{organization_slug}/bookings/{booking_id}", response_model=CustomerBookingResponse)
def customer_reschedule_booking(
    booking_id: uuid.UUID,
    payload: BookingReschedule,
    principal: CustomerWritePrincipal,
    db: DatabaseSession,
) -> CustomerBookingResponse:
    return reschedule_booking(
        db,
        principal.organization.id,
        principal.organization.timezone,
        principal.user.id,
        booking_id,
        payload,
    )


@router.post(
    "/{organization_slug}/bookings/{booking_id}/cancel",
    response_model=CustomerBookingResponse,
)
def customer_cancel_booking(
    booking_id: uuid.UUID,
    principal: CustomerWritePrincipal,
    db: DatabaseSession,
) -> CustomerBookingResponse:
    return cancel_booking(db, principal.organization.id, principal.user.id, booking_id)
