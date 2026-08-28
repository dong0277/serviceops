from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Booking, Organization, Service, StaffProfile
from app.seed import seed_booking_data, seed_identity_data


def test_demo_seed_is_idempotent_and_populates_booking_domain(db: Session) -> None:
    seed_identity_data(db)
    seed_booking_data(db)
    seed_identity_data(db)
    seed_booking_data(db)

    organization = db.scalar(select(Organization).where(Organization.slug == "demo-services"))
    assert organization is not None
    assert (
        db.scalar(
            select(func.count())
            .select_from(Service)
            .where(Service.organization_id == organization.id)
        )
        == 3
    )
    assert (
        db.scalar(
            select(func.count())
            .select_from(StaffProfile)
            .where(StaffProfile.organization_id == organization.id)
        )
        == 2
    )
    assert (
        db.scalar(
            select(func.count())
            .select_from(Booking)
            .where(Booking.organization_id == organization.id)
        )
        == 4
    )
