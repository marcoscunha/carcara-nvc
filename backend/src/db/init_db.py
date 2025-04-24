from sqlalchemy.orm import Session

from .base_class import Base
from ..models import camera, stream, detection
from ..db.session import engine


def init_db() -> None:
    # Create all tables
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_db()
    print("Database tables created successfully!")