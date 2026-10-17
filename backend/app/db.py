import os
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


def _database_url() -> str:
    """
    Use PostgreSQL in production when DATABASE_URL is configured.

    Local development falls back to a SQLite file so the quotation
    save/edit workflow can be tested without installing PostgreSQL.
    """
    raw_url = os.getenv(
        "DATABASE_URL",
        "sqlite:///./quotation_generator.db",
    ).strip()

    # Some hosting providers still expose the legacy postgres:// prefix.
    # SQLAlchemy expects postgresql://.
    if raw_url.startswith("postgres://"):
        raw_url = (
            "postgresql://"
            + raw_url[len("postgres://") :]
        )

    return raw_url


DATABASE_URL = _database_url()


class Base(DeclarativeBase):
    pass


def _create_engine() -> Engine:
    connect_args: dict[str, object] = {}

    if DATABASE_URL.startswith("sqlite"):
        connect_args["check_same_thread"] = False

    return create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        connect_args=connect_args,
    )


engine = _create_engine()


SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    class_=Session,
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
