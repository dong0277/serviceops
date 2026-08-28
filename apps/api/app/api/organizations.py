from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.dependencies import DatabaseSession, require_organization_roles
from app.models import MembershipRole
from app.schemas import MemberSummary
from app.services.tenancy import OrganizationPrincipal, list_organization_members

router = APIRouter(prefix="/api/v1/organizations", tags=["organizations"])

OwnerPrincipal = Annotated[
    OrganizationPrincipal,
    Depends(require_organization_roles(MembershipRole.OWNER)),
]


@router.get("/{organization_slug}/members", response_model=list[MemberSummary])
def list_members(
    principal: OwnerPrincipal,
    db: DatabaseSession,
) -> list[MemberSummary]:
    return list_organization_members(db, principal.organization.id)
