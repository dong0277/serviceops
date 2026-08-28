import uuid
from enum import StrEnum

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.domain_schemas import AuditLogResponse
from app.models import AuditLog


class AuditAction(StrEnum):
    SERVICE_CREATED = "service_created"
    SERVICE_UPDATED = "service_updated"
    SERVICE_DEACTIVATED = "service_deactivated"
    STAFF_ADDED = "staff_added"
    STAFF_UPDATED = "staff_updated"
    STAFF_DEACTIVATED = "staff_deactivated"
    BOOKING_CREATED = "booking_created"
    BOOKING_RESCHEDULED = "booking_rescheduled"
    STAFF_ASSIGNMENT_CHANGED = "staff_assignment_changed"
    BOOKING_STATUS_CHANGED = "booking_status_changed"
    BOOKING_CANCELLED = "booking_cancelled"
    BOOKING_INTERNAL_NOTE_UPDATED = "booking_internal_note_updated"
    CSV_EXPORT_REQUESTED = "csv_export_requested"


def record_audit(
    db: Session,
    organization_id: uuid.UUID,
    actor_user_id: uuid.UUID | None,
    action: AuditAction,
    entity_type: str,
    entity_id: uuid.UUID | None,
    metadata: dict[str, object] | None = None,
) -> AuditLog:
    entry = AuditLog(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        action=action.value,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata_json=metadata or {},
    )
    db.add(entry)
    return entry


def list_audit_logs(
    db: Session,
    organization_id: uuid.UUID,
    *,
    action: str | None = None,
    entity_type: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[AuditLogResponse]:
    statement = (
        select(AuditLog)
        .options(selectinload(AuditLog.actor))
        .where(AuditLog.organization_id == organization_id)
    )
    if action is not None:
        statement = statement.where(AuditLog.action == action)
    if entity_type is not None:
        statement = statement.where(AuditLog.entity_type == entity_type)
    entries = db.scalars(
        statement.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return [
        AuditLogResponse(
            id=entry.id,
            actor_user_id=entry.actor_user_id,
            actor_display_name=entry.actor.display_name if entry.actor else None,
            action=entry.action,
            entity_type=entry.entity_type,
            entity_id=entry.entity_id,
            metadata_json=entry.metadata_json,
            created_at=entry.created_at,
        )
        for entry in entries
    ]
