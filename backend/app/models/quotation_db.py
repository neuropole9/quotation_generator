import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    String,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
)

from app.db import Base


class QuotationDB(Base):
    __tablename__ = "quotations"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    clerk_user_id: Mapped[str] = mapped_column(
        String(255),
        index=True,
        nullable=False,
    )

    quote_number: Mapped[str] = mapped_column(
        String(255),
        index=True,
        default="",
    )

    customer_name: Mapped[str] = mapped_column(
        String(255),
        default="",
    )

    project_name: Mapped[str] = mapped_column(
        String(255),
        default="",
    )

    status: Mapped[str] = mapped_column(
        String(50),
        default="draft",
        index=True,
    )

    quotation_data: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )