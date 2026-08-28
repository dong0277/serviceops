import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator

from app.models import MembershipRole
from app.security import normalize_email


class RegisterRequest(BaseModel):
    email: str
    password: SecretStr = Field(min_length=12, max_length=128)
    display_name: str = Field(min_length=1, max_length=100)
    organization_slug: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9-]+$")

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)

    @field_validator("display_name")
    @classmethod
    def clean_display_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Display name cannot be empty.")
        return cleaned


class LoginRequest(BaseModel):
    email: str
    password: SecretStr = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)


class OrganizationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    timezone: str


class MembershipSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: MembershipRole
    organization: OrganizationSummary


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str
    is_active: bool
    memberships: list[MembershipSummary]


class AuthResponse(BaseModel):
    user: UserSummary
    access_expires_at: datetime
    refresh_expires_at: datetime
    csrf_token: str


class MessageResponse(BaseModel):
    message: str


class MemberSummary(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    email: str
    display_name: str
    role: MembershipRole
    created_at: datetime
