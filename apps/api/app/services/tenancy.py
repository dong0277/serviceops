from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Membership, MembershipRole, Organization, User
from app.schemas import MemberSummary


@dataclass(frozen=True)
class OrganizationPrincipal:
    organization: Organization
    membership: Membership
    user: User


def authorize_organization(
    user: User,
    organization_slug: str,
    allowed_roles: frozenset[MembershipRole],
) -> OrganizationPrincipal:
    membership = next(
        (
            candidate
            for candidate in user.memberships
            if candidate.organization.slug == organization_slug
        ),
        None,
    )
    if membership is None:
        raise ApiError(404, "organization_not_found", "The organization was not found.")
    if membership.role not in allowed_roles:
        raise ApiError(403, "role_forbidden", "Your role cannot perform this operation.")
    return OrganizationPrincipal(membership.organization, membership, user)


def list_organization_members(db: Session, organization_id: object) -> list[MemberSummary]:
    rows = db.execute(
        select(Membership, User)
        .join(User, Membership.user_id == User.id)
        .where(Membership.organization_id == organization_id)
        .order_by(User.display_name, User.email)
    ).all()
    return [
        MemberSummary(
            id=membership.id,
            user_id=user.id,
            email=user.email,
            display_name=user.display_name,
            role=membership.role,
            created_at=membership.created_at,
        )
        for membership, user in rows
    ]
