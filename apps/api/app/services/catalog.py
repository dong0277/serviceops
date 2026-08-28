import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain_schemas import ServiceCreate, ServiceUpdate
from app.errors import ApiError
from app.models import Organization, Service
from app.services.audit import AuditAction, record_audit


def get_organization_by_slug(db: Session, organization_slug: str) -> Organization:
    organization = db.scalar(select(Organization).where(Organization.slug == organization_slug))
    if organization is None:
        raise ApiError(404, "organization_not_found", "The organization was not found.")
    return organization


def list_services(db: Session, organization_id: uuid.UUID, *, active_only: bool) -> list[Service]:
    statement = select(Service).where(Service.organization_id == organization_id)
    if active_only:
        statement = statement.where(Service.is_active.is_(True))
    return list(db.scalars(statement.order_by(Service.name, Service.id)))


def get_service(
    db: Session,
    organization_id: uuid.UUID,
    service_id: uuid.UUID,
    *,
    active_only: bool = False,
) -> Service:
    statement = select(Service).where(
        Service.id == service_id,
        Service.organization_id == organization_id,
    )
    if active_only:
        statement = statement.where(Service.is_active.is_(True))
    service = db.scalar(statement)
    if service is None:
        raise ApiError(404, "service_not_found", "The service was not found.")
    return service


def create_service(
    db: Session,
    organization_id: uuid.UUID,
    payload: ServiceCreate,
    *,
    actor_user_id: uuid.UUID,
) -> Service:
    service = Service(organization_id=organization_id, **payload.model_dump())
    db.add(service)
    db.flush()
    record_audit(
        db,
        organization_id,
        actor_user_id,
        AuditAction.SERVICE_CREATED,
        "service",
        service.id,
    )
    db.commit()
    return service


def update_service(
    db: Session,
    organization_id: uuid.UUID,
    service_id: uuid.UUID,
    payload: ServiceUpdate,
    *,
    actor_user_id: uuid.UUID,
) -> Service:
    service = get_service(db, organization_id, service_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(service, field, value)
    record_audit(
        db,
        organization_id,
        actor_user_id,
        AuditAction.SERVICE_UPDATED,
        "service",
        service.id,
        {"changed_fields": sorted(payload.model_fields_set)},
    )
    db.commit()
    return service


def deactivate_service(
    db: Session,
    organization_id: uuid.UUID,
    service_id: uuid.UUID,
    *,
    actor_user_id: uuid.UUID,
) -> None:
    service = get_service(db, organization_id, service_id)
    service.is_active = False
    record_audit(
        db,
        organization_id,
        actor_user_id,
        AuditAction.SERVICE_DEACTIVATED,
        "service",
        service.id,
    )
    db.commit()
