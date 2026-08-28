import os
import uuid
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from alembic import command
from app.config import Settings
from app.database import Database, get_db
from app.main import create_app
from app.models import Membership, MembershipRole, Organization, User
from app.security import hash_password

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://serviceops_test:serviceops-test-only@127.0.0.1:5433/serviceops_test",
)
API_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def migrated_engine() -> Iterator[Engine]:
    alembic_config = Config(API_ROOT / "alembic.ini")
    alembic_config.set_main_option("sqlalchemy.url", TEST_DATABASE_URL.replace("%", "%%"))
    command.upgrade(alembic_config, "head")
    engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture
def db(migrated_engine: Engine) -> Iterator[Session]:
    connection = migrated_engine.connect()
    transaction = connection.begin()
    session = Session(
        bind=connection,
        autoflush=False,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def settings() -> Settings:
    return Settings(
        app_env="test",
        database_url=TEST_DATABASE_URL,
        cors_allowed_origins="http://testserver,http://localhost:3001",
        cookie_secure=False,
        access_token_ttl_seconds=900,
        refresh_token_ttl_seconds=604800,
        login_rate_limit_attempts=5,
        login_rate_limit_window_seconds=60,
    )


@pytest.fixture
def client(db: Session, settings: Settings) -> Iterator[TestClient]:
    database = Database(settings.sqlalchemy_database_url)
    application = create_app(settings=settings, database=database)

    def override_get_db() -> Iterator[Session]:
        yield db

    application.dependency_overrides[get_db] = override_get_db
    with TestClient(application, base_url="http://testserver") as test_client:
        yield test_client


@pytest.fixture
def demo_organization(db: Session) -> Organization:
    organization = Organization(
        id=uuid.uuid4(),
        name="테스트 서비스",
        slug="test-services",
        timezone="Asia/Seoul",
    )
    db.add(organization)
    db.commit()
    return organization


def create_identity(
    db: Session,
    organization: Organization,
    *,
    email: str,
    role: MembershipRole,
    display_name: str = "테스트 사용자",
    password: str = "Correct-Horse-2026!",
) -> User:
    user = User(
        email=email,
        password_hash=hash_password(password),
        display_name=display_name,
    )
    membership = Membership(organization=organization, user=user, role=role)
    db.add_all([user, membership])
    db.commit()
    return user
