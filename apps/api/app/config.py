from functools import lru_cache
from pathlib import Path
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


def find_local_env_file() -> Path:
    module_directory = Path(__file__).resolve().parent
    for directory in (module_directory, *module_directory.parents):
        candidate = directory / ".env"
        if candidate.is_file():
            return candidate
    return Path.cwd() / ".env"


REPOSITORY_ENV_FILE = find_local_env_file()


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=REPOSITORY_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    database_url: str | None = None
    postgres_host: str = "127.0.0.1"
    postgres_port: int = 5432
    postgres_db: str = "serviceops"
    postgres_user: str = "serviceops"
    postgres_password: str = "replace-with-a-local-password"
    cors_allowed_origins: str = (
        "http://localhost:3000,http://localhost:3001,http://localhost:8000,"
        "http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:8000"
    )
    cookie_secure: bool = False
    access_token_ttl_seconds: int = 15 * 60
    refresh_token_ttl_seconds: int = 7 * 24 * 60 * 60
    login_rate_limit_attempts: int = 5
    login_rate_limit_window_seconds: int = 60

    @property
    def allowed_origins(self) -> tuple[str, ...]:
        return tuple(
            origin.strip().rstrip("/")
            for origin in self.cors_allowed_origins.split(",")
            if origin.strip()
        )

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url is not None:
            return self.database_url
        user = quote_plus(self.postgres_user)
        password = quote_plus(self.postgres_password)
        return (
            f"postgresql+psycopg://{user}:{password}@"
            f"{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
