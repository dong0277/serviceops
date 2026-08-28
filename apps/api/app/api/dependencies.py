from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.errors import ApiError
from app.models import AuthSession, MembershipRole
from app.security import (
    ACCESS_COOKIE_NAME,
    CSRF_COOKIE_NAME,
    CSRF_HEADER_NAME,
    require_trusted_origin,
)
from app.services.auth import find_access_session, verify_session_csrf
from app.services.tenancy import OrganizationPrincipal, authorize_organization

DatabaseSession = Annotated[Session, Depends(get_db)]


def get_authenticated_session(request: Request, db: DatabaseSession) -> AuthSession:
    access_token = request.cookies.get(ACCESS_COOKIE_NAME)
    if access_token is None:
        raise ApiError(401, "authentication_required", "Authentication is required.")
    auth_session = find_access_session(db, access_token)
    if auth_session is None:
        raise ApiError(401, "authentication_required", "Authentication is required.")
    return auth_session


AuthenticatedSession = Annotated[AuthSession, Depends(get_authenticated_session)]


def get_csrf_protected_session(
    request: Request,
    auth_session: AuthenticatedSession,
) -> AuthSession:
    require_trusted_origin(request, request.app.state.settings)
    csrf_cookie = request.cookies.get(CSRF_COOKIE_NAME)
    csrf_header = request.headers.get(CSRF_HEADER_NAME)
    if csrf_cookie is None or csrf_header is None:
        raise ApiError(403, "csrf_failed", "CSRF validation failed.")
    verify_session_csrf(auth_session, csrf_cookie, csrf_header)
    return auth_session


CsrfProtectedSession = Annotated[AuthSession, Depends(get_csrf_protected_session)]


def require_organization_roles(
    *allowed_roles: MembershipRole,
) -> Callable[[str, AuthenticatedSession], OrganizationPrincipal]:
    allowed = frozenset(allowed_roles)

    def dependency(
        organization_slug: str,
        auth_session: AuthenticatedSession,
    ) -> OrganizationPrincipal:
        return authorize_organization(auth_session.user, organization_slug, allowed)

    return dependency


def require_organization_write_roles(
    *allowed_roles: MembershipRole,
) -> Callable[[str, CsrfProtectedSession], OrganizationPrincipal]:
    allowed = frozenset(allowed_roles)

    def dependency(
        organization_slug: str,
        auth_session: CsrfProtectedSession,
    ) -> OrganizationPrincipal:
        return authorize_organization(auth_session.user, organization_slug, allowed)

    return dependency
