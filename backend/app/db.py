import os
from collections.abc import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


# Load backend/.env during local development.
# On Render, environment variables are supplied by the service itself.
load_dotenv()


def _database_url() -> str:
    """
    Return the PostgreSQL connection URL.

    This project is PostgreSQL-only. SQLite fallback is intentionally
    disabled so local and production environments use the same database
    engine and behavior.
    """
    raw_url = os.getenv(
        "DATABASE_URL",
        "",
    ).strip()

    if not raw_url:
        raise RuntimeError(
            "DATABASE_URL is required. "
            "Set it to a PostgreSQL connection string."
        )

    # Render and some PostgreSQL providers expose postgresql:// or the
    # legacy postgres:// scheme. The installed driver is psycopg v3, so
    # normalize both forms to SQLAlchemy's explicit psycopg dialect.
    if raw_url.startswith(
        "postgres://"
    ):
        raw_url = (
            "postgresql+psycopg://"
            + raw_url[
                len("postgres://") :
            ]
        )
    elif raw_url.startswith(
        "postgresql://"
    ):
        raw_url = (
            "postgresql+psycopg://"
            + raw_url[
                len("postgresql://") :
            ]
        )
    elif not raw_url.startswith(
        "postgresql+psycopg://"
    ):
        raise RuntimeError(
            "DATABASE_URL must use PostgreSQL."
        )

    return raw_url


DATABASE_URL = _database_url()


class Base(DeclarativeBase):
    pass


def _create_engine() -> Engine:
    return create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
    )


engine = _create_engine()


SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
    class_=Session,
)


def get_db() -> Generator[
    Session,
    None,
    None,
]:
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
