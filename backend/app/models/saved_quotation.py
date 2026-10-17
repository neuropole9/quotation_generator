from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc)


class SavedQuotation(Base):
    __tablename__ = "saved_quotations"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    # DRAFT / SAVED
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="DRAFT",
        index=True,
    )

    quote_number: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
        index=True,
    )

    customer_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )

    customer_company: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    project_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )

    quote_date: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    # Clerk user id of the user who originally created the quotation.
    #
    # Keep nullable=True for backward compatibility with quotations that were
    # created before creator tracking was introduced. New quotations will be
    # populated by the authenticated backend route.
    owner_user_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )

    # Human-readable creator information shown to Admin/Super Admin.
    # These values are written by the backend from the authenticated user,
    # never accepted as trusted values from the quotation form itself.
    created_by_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )

    created_by_email: Mapped[str | None] = mapped_column(
        String(320),
        nullable=True,
        index=True,
    )

    # Full quotation payload used by the existing editor/PDF workflow.
    quotation_data: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        index=True,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
        index=True,
    )

    __table_args__ = (
        Index(
            "ix_saved_quotations_owner_updated",
            "owner_user_id",
            "updated_at",
        ),
    )