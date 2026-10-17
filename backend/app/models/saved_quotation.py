from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SavedQuotation(Base):
    """
    Database record for a quotation.

    The complete QuotationData payload is stored in quotation_data so
    reopening a saved quotation restores the exact editor state:
    company, customer, quote details, abstract rows, products, columns,
    notes, terms, signature, theme, etc.

    Important searchable fields are also stored separately so the
    quotation list page can filter/sort without reading every JSON blob.
    """

    __tablename__ = "saved_quotations"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="DRAFT",
        index=True,
    )

    quote_number: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        default="",
        index=True,
    )

    customer_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        default="",
        index=True,
    )

    customer_company: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        default="",
        index=True,
    )

    project_name: Mapped[str] = mapped_column(
        String(250),
        nullable=False,
        default="",
        index=True,
    )

    quote_date: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="",
        index=True,
    )

    # Reserved for Clerk/user ownership once quotation auth is connected.
    # It remains nullable so the save/edit workflow can be implemented
    # before the existing authentication issue is resolved.
    owner_user_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )

    quotation_data: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
    )

    notes: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
        index=True,
    )
