from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.config import Settings
from app.errors import ApiError
from app.models import AuthSession, Membership, MembershipRole, Organization, User
from app.schemas import RegisterRequest
from app.security import (
    DUMMY_PASSWORD_HASH,
    credentials_match,
    generate_credential,
    hash_credential,
    hash_password,
    verify_password,
)


@dataclass(frozen=True)
class IssuedCredentials:
    session: AuthSession
    access_token: str
    refresh_token: str
    csrf_token: str


def register_customer(db: Session, payload: RegisterRequest) -> User:
    organization = db.scalar(
        select(Organization).where(Organization.slug == payload.organization_slug)
    )
    if organization is None:
        raise ApiError(404, "organization_not_found", "The organization was not found.")

    existing_user = db.scalar(select(User.id).where(User.email == payload.email))
    if existing_user is not None:
        raise ApiError(409, "registration_failed", "Registration could not be completed.")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password.get_secret_value()),
        display_name=payload.display_name,
    )
    membership = Membership(
        organization=organization,
        user=user,
        role=MembershipRole.CUSTOMER,
    )
    db.add_all([user, membership])
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ApiError(409, "registration_failed", "Registration could not be completed.") from exc
    return load_user_with_memberships(db, user.id)


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.email == email))
    password_hash = user.password_hash if user is not None else DUMMY_PASSWORD_HASH
    password_valid = verify_password(password, password_hash)
    if user is None or not password_valid or not user.is_active:
        return None
    return load_user_with_memberships(db, user.id)


def issue_session(db: Session, user: User, settings: Settings) -> IssuedCredentials:
    now = datetime.now(UTC)
    access_token = generate_credential()
    refresh_token = generate_credential()
    csrf_token = generate_credential()
    auth_session = AuthSession(
        user_id=user.id,
        access_token_hash=hash_credential(access_token),
        refresh_token_hash=hash_credential(refresh_token),
        csrf_token_hash=hash_credential(csrf_token),
        access_expires_at=now + timedelta(seconds=settings.access_token_ttl_seconds),
        refresh_expires_at=now + timedelta(seconds=settings.refresh_token_ttl_seconds),
        last_used_at=now,
    )
    db.add(auth_session)
    db.commit()
    return IssuedCredentials(auth_session, access_token, refresh_token, csrf_token)


def find_access_session(db: Session, access_token: str) -> AuthSession | None:
    now = datetime.now(UTC)
    return db.scalar(
        select(AuthSession)
        .options(
            selectinload(AuthSession.user)
            .selectinload(User.memberships)
            .joinedload(Membership.organization)
        )
        .where(
            AuthSession.access_token_hash == hash_credential(access_token),
            AuthSession.revoked_at.is_(None),
            AuthSession.access_expires_at > now,
            User.is_active.is_(True),
        )
        .join(AuthSession.user)
    )


def find_refresh_session_for_update(db: Session, refresh_token: str) -> AuthSession | None:
    now = datetime.now(UTC)
    return db.scalar(
        select(AuthSession)
        .options(
            selectinload(AuthSession.user)
            .selectinload(User.memberships)
            .joinedload(Membership.organization)
        )
        .where(
            AuthSession.refresh_token_hash == hash_credential(refresh_token),
            AuthSession.revoked_at.is_(None),
            AuthSession.refresh_expires_at > now,
            User.is_active.is_(True),
        )
        .join(AuthSession.user)
        .with_for_update(of=AuthSession)
    )


def rotate_session(
    db: Session,
    auth_session: AuthSession,
    csrf_token: str,
    settings: Settings,
) -> IssuedCredentials:
    if not credentials_match(auth_session.csrf_token_hash, hash_credential(csrf_token)):
        raise ApiError(403, "csrf_failed", "CSRF validation failed.")

    now = datetime.now(UTC)
    access_token = generate_credential()
    refresh_token = generate_credential()
    next_csrf_token = generate_credential()
    auth_session.access_token_hash = hash_credential(access_token)
    auth_session.refresh_token_hash = hash_credential(refresh_token)
    auth_session.csrf_token_hash = hash_credential(next_csrf_token)
    auth_session.access_expires_at = now + timedelta(seconds=settings.access_token_ttl_seconds)
    auth_session.refresh_expires_at = now + timedelta(seconds=settings.refresh_token_ttl_seconds)
    auth_session.rotation_count += 1
    auth_session.last_used_at = now
    db.commit()
    return IssuedCredentials(auth_session, access_token, refresh_token, next_csrf_token)


def revoke_session(db: Session, auth_session: AuthSession) -> None:
    auth_session.revoked_at = datetime.now(UTC)
    db.commit()


def verify_session_csrf(auth_session: AuthSession, cookie_token: str, header_token: str) -> None:
    if not credentials_match(cookie_token, header_token) or not credentials_match(
        auth_session.csrf_token_hash, hash_credential(header_token)
    ):
        raise ApiError(403, "csrf_failed", "CSRF validation failed.")


def load_user_with_memberships(db: Session, user_id: object) -> User:
    user = db.scalar(
        select(User)
        .options(selectinload(User.memberships).joinedload(Membership.organization))
        .where(User.id == user_id)
    )
    if user is None:
        raise ApiError(401, "authentication_required", "Authentication is required.")
    return user
