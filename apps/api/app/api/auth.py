from fastapi import APIRouter, Request, Response

from app.api.dependencies import AuthenticatedSession, DatabaseSession
from app.config import Settings
from app.errors import ApiError
from app.schemas import AuthResponse, LoginRequest, MessageResponse, RegisterRequest, UserSummary
from app.security import (
    ACCESS_COOKIE_NAME,
    CSRF_COOKIE_NAME,
    CSRF_HEADER_NAME,
    REFRESH_COOKIE_NAME,
    LoginRateLimiter,
    login_rate_key,
    require_trusted_origin,
)
from app.services.auth import (
    IssuedCredentials,
    authenticate_user,
    find_access_session,
    find_refresh_session_for_update,
    issue_session,
    register_customer,
    revoke_session,
    rotate_session,
    verify_session_csrf,
)

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])


def _settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def _set_session_cookies(
    response: Response,
    credentials: IssuedCredentials,
    settings: Settings,
) -> None:
    response.set_cookie(
        ACCESS_COOKIE_NAME,
        credentials.access_token,
        httponly=True,
        max_age=settings.access_token_ttl_seconds,
        expires=credentials.session.access_expires_at,
        path="/",
        secure=settings.cookie_secure,
        samesite="lax",
    )
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        credentials.refresh_token,
        httponly=True,
        max_age=settings.refresh_token_ttl_seconds,
        expires=credentials.session.refresh_expires_at,
        path="/api/v1/auth",
        secure=settings.cookie_secure,
        samesite="lax",
    )
    response.set_cookie(
        CSRF_COOKIE_NAME,
        credentials.csrf_token,
        httponly=False,
        max_age=settings.refresh_token_ttl_seconds,
        expires=credentials.session.refresh_expires_at,
        path="/",
        secure=settings.cookie_secure,
        samesite="lax",
    )


def _clear_session_cookies(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        ACCESS_COOKIE_NAME,
        path="/",
        secure=settings.cookie_secure,
        httponly=True,
        samesite="lax",
    )
    response.delete_cookie(
        REFRESH_COOKIE_NAME,
        path="/api/v1/auth",
        secure=settings.cookie_secure,
        httponly=True,
        samesite="lax",
    )
    response.delete_cookie(
        CSRF_COOKIE_NAME,
        path="/",
        secure=settings.cookie_secure,
        httponly=False,
        samesite="lax",
    )


def _auth_response(credentials: IssuedCredentials) -> AuthResponse:
    return AuthResponse(
        user=UserSummary.model_validate(credentials.session.user),
        access_expires_at=credentials.session.access_expires_at,
        refresh_expires_at=credentials.session.refresh_expires_at,
        csrf_token=credentials.csrf_token,
    )


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: DatabaseSession,
) -> AuthResponse:
    settings = _settings(request)
    require_trusted_origin(request, settings)
    user = register_customer(db, payload)
    credentials = issue_session(db, user, settings)
    credentials.session.user = user
    _set_session_cookies(response, credentials, settings)
    return _auth_response(credentials)


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: DatabaseSession,
) -> AuthResponse:
    settings = _settings(request)
    require_trusted_origin(request, settings)
    client_host = request.client.host if request.client is not None else "unknown"
    key = login_rate_key(payload.email, client_host)
    limiter: LoginRateLimiter = request.app.state.login_rate_limiter
    limit = limiter.check(key)
    if not limit.allowed:
        raise ApiError(
            429,
            "login_rate_limited",
            "Too many login attempts. Try again later.",
            headers={"Retry-After": str(limit.retry_after_seconds)},
        )

    user = authenticate_user(db, payload.email, payload.password.get_secret_value())
    if user is None:
        limiter.record_failure(key)
        raise ApiError(401, "invalid_credentials", "Email or password is incorrect.")

    limiter.clear(key)
    credentials = issue_session(db, user, settings)
    credentials.session.user = user
    _set_session_cookies(response, credentials, settings)
    return _auth_response(credentials)


@router.post("/refresh", response_model=AuthResponse)
def refresh(
    request: Request,
    response: Response,
    db: DatabaseSession,
) -> AuthResponse:
    settings = _settings(request)
    require_trusted_origin(request, settings)
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    csrf_cookie = request.cookies.get(CSRF_COOKIE_NAME)
    csrf_header = request.headers.get(CSRF_HEADER_NAME)
    if refresh_token is None or csrf_cookie is None or csrf_header is None:
        raise ApiError(401, "invalid_session", "The session is invalid or expired.")

    auth_session = find_refresh_session_for_update(db, refresh_token)
    if auth_session is None:
        raise ApiError(401, "invalid_session", "The session is invalid or expired.")
    verify_session_csrf(auth_session, csrf_cookie, csrf_header)
    credentials = rotate_session(db, auth_session, csrf_header, settings)
    _set_session_cookies(response, credentials, settings)
    return _auth_response(credentials)


@router.post("/logout", response_model=MessageResponse)
def logout(
    request: Request,
    response: Response,
    db: DatabaseSession,
) -> MessageResponse:
    settings = _settings(request)
    require_trusted_origin(request, settings)
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    access_token = request.cookies.get(ACCESS_COOKIE_NAME)
    auth_session = (
        find_refresh_session_for_update(db, refresh_token)
        if refresh_token is not None
        else find_access_session(db, access_token)
        if access_token is not None
        else None
    )
    if auth_session is not None:
        csrf_cookie = request.cookies.get(CSRF_COOKIE_NAME)
        csrf_header = request.headers.get(CSRF_HEADER_NAME)
        if csrf_cookie is None or csrf_header is None:
            raise ApiError(403, "csrf_failed", "CSRF validation failed.")
        verify_session_csrf(auth_session, csrf_cookie, csrf_header)
        revoke_session(db, auth_session)
    _clear_session_cookies(response, settings)
    return MessageResponse(message="Signed out.")


@router.get("/me", response_model=UserSummary)
def current_user(auth_session: AuthenticatedSession) -> UserSummary:
    return UserSummary.model_validate(auth_session.user)
