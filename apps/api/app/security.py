import hashlib
import hmac
import secrets
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass

from email_validator import EmailNotValidError, validate_email
from fastapi import Request
from pwdlib import PasswordHash

from app.config import Settings
from app.errors import ApiError

ACCESS_COOKIE_NAME = "serviceops_access"
REFRESH_COOKIE_NAME = "serviceops_refresh"
CSRF_COOKIE_NAME = "serviceops_csrf"
CSRF_HEADER_NAME = "x-csrf-token"

password_hasher = PasswordHash.recommended()
DUMMY_PASSWORD_HASH = password_hasher.hash("serviceops-dummy-password-not-used")


def normalize_email(value: str) -> str:
    try:
        result = validate_email(
            value.strip(),
            check_deliverability=False,
            test_environment=True,
        )
    except EmailNotValidError as exc:
        raise ValueError("Enter a valid email address.") from exc
    return result.normalized.lower()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_hasher.verify(password, password_hash)


def generate_credential() -> str:
    return secrets.token_urlsafe(48)


def hash_credential(credential: str) -> str:
    return hashlib.sha256(credential.encode("utf-8")).hexdigest()


def credentials_match(left: str, right: str) -> bool:
    return hmac.compare_digest(left, right)


def require_trusted_origin(request: Request, settings: Settings) -> None:
    origin = request.headers.get("origin")
    if origin is not None and origin.rstrip("/") not in settings.allowed_origins:
        raise ApiError(403, "untrusted_origin", "The request origin is not allowed.")


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    retry_after_seconds: int = 0


class LoginRateLimiter:
    """Small single-process limiter; deployment limitations are documented."""

    def __init__(self, max_attempts: int, window_seconds: int) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> RateLimitResult:
        now = time.monotonic()
        with self._lock:
            attempts = self._attempts[key]
            self._discard_expired(attempts, now)
            if len(attempts) < self.max_attempts:
                return RateLimitResult(allowed=True)
            retry_after = max(1, int(self.window_seconds - (now - attempts[0])))
            return RateLimitResult(allowed=False, retry_after_seconds=retry_after)

    def record_failure(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            attempts = self._attempts[key]
            self._discard_expired(attempts, now)
            attempts.append(now)

    def clear(self, key: str) -> None:
        with self._lock:
            self._attempts.pop(key, None)

    def _discard_expired(self, attempts: deque[float], now: float) -> None:
        threshold = now - self.window_seconds
        while attempts and attempts[0] <= threshold:
            attempts.popleft()


def login_rate_key(email: str, client_host: str) -> str:
    return hash_credential(f"{client_host}:{email}")
