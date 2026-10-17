from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, or_, select
from sqlalchemy.orm import Session

from app.auth.clerk_auth import (
    get_current_user,
    get_user_display_name,
    get_user_primary_email,
    is_admin_user,
)
from app.db import get_db
from app.models.quotation import QuotationData
from app.models.saved_quotation import SavedQuotation


router = APIRouter(
    prefix="/quotations",
    tags=["saved quotations"],
)


QuotationStatus = Literal[
    "DRAFT",
    "SAVED",
]


class SaveQuotationRequest(BaseModel):
    status: QuotationStatus = "DRAFT"
    data: QuotationData

    # Kept only for backward compatibility with the existing frontend payload.
    # The backend intentionally ignores this value and always derives ownership
    # from the authenticated Clerk session.
    ownerUserId: str | None = None


class QuotationSummaryResponse(BaseModel):
    id: int
    status: QuotationStatus

    quoteNumber: str
    customerName: str
    customerCompany: str
    projectName: str
    quoteDate: str

    ownerUserId: str | None = None
    createdByName: str | None = None
    createdByEmail: str | None = None

    createdAt: datetime
    updatedAt: datetime


class SavedQuotationResponse(
    QuotationSummaryResponse
):
    data: QuotationData


class DeleteQuotationResponse(BaseModel):
    success: bool = True
    id: int


class QuotationListResponse(BaseModel):
    items: list[
        QuotationSummaryResponse
    ] = Field(
        default_factory=list
    )
    total: int = 0


def _clean(
    value: object,
) -> str:
    return str(
        value or ""
    ).strip()


def _current_user_id(
    current_user: dict[str, Any],
) -> str:
    user_id = _clean(
        current_user.get(
            "id"
        )
    )

    if not user_id:
        raise HTTPException(
            status_code=
                status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Authenticated user "
                "identifier is missing."
            ),
        )

    return user_id


def _extract_search_fields(
    data: QuotationData,
) -> dict[str, str]:
    return {
        "quote_number":
            _clean(
                data.quote
                .quoteNumber
            ),
        "customer_name":
            _clean(
                data.customer.name
            ),
        "customer_company":
            _clean(
                data.customer
                .company
            ),
        "project_name":
            _clean(
                data.quote
                .projectName
            ),
        "quote_date":
            _clean(
                data.quote
                .quoteDate
            ),
        "notes":
            _clean(
                data.notes
            ),
    }


def _validate_saved_quotation(
    data: QuotationData,
) -> None:
    """
    Drafts may be incomplete.

    A quotation marked SAVED must contain the minimum
    information required to reopen and generate a usable
    commercial document.
    """
    problems: list[str] = []

    if not _clean(
        data.quote.quoteNumber
    ):
        problems.append(
            "Quotation number is required."
        )

    has_abstract = any(
        _clean(
            item.description
        )
        for item
        in data.abstractItems
    )

    if not has_abstract:
        problems.append(
            "At least one abstract item is required."
        )

    has_product = any(
        _clean(
            product.description
        )
        for product
        in data.products
    )

    if not has_product:
        problems.append(
            "At least one product is required."
        )

    has_visible_column = any(
        column.visible
        for column
        in data.columns
    )

    if not has_visible_column:
        problems.append(
            "At least one product column must be visible."
        )

    if problems:
        raise HTTPException(
            status_code=
                status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=problems,
        )


def _summary(
    record: SavedQuotation,
) -> QuotationSummaryResponse:
    return QuotationSummaryResponse(
        id=record.id,
        status=record.status,
        quoteNumber=
            _clean(
                record.quote_number
            ),
        customerName=
            _clean(
                record.customer_name
            ),
        customerCompany=
            _clean(
                record.customer_company
            ),
        projectName=
            _clean(
                record.project_name
            ),
        quoteDate=
            _clean(
                record.quote_date
            ),
        ownerUserId=
            record.owner_user_id,
        createdByName=
            record.created_by_name,
        createdByEmail=
            record.created_by_email,
        createdAt=
            record.created_at,
        updatedAt=
            record.updated_at,
    )


def _detail(
    record: SavedQuotation,
) -> SavedQuotationResponse:
    try:
        quotation_data = (
            QuotationData
            .model_validate(
                record
                .quotation_data
            )
        )
    except Exception as exc:
        raise HTTPException(
            status_code=
                status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Saved quotation data "
                "is invalid."
            ),
        ) from exc

    return SavedQuotationResponse(
        **_summary(
            record
        ).model_dump(),
        data=quotation_data,
    )


def _get_record(
    quotation_id: int,
    db: Session,
) -> SavedQuotation:
    record = db.get(
        SavedQuotation,
        quotation_id,
    )

    if record is None:
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail=
                "Quotation not found.",
        )

    return record


def _get_accessible_record(
    quotation_id: int,
    db: Session,
    current_user: dict[str, Any],
) -> SavedQuotation:
    record = _get_record(
        quotation_id,
        db,
    )

    if is_admin_user(
        current_user
    ):
        return record

    user_id = _current_user_id(
        current_user
    )

    if (
        not record.owner_user_id
        or record.owner_user_id
        != user_id
    ):
        # Return 404 instead of 403 so a normal user cannot
        # discover whether another user's quotation ID exists.
        raise HTTPException(
            status_code=
                status.HTTP_404_NOT_FOUND,
            detail=
                "Quotation not found.",
        )

    return record


@router.post(
    "",
    response_model=
        SavedQuotationResponse,
    status_code=
        status.HTTP_201_CREATED,
)
def create_quotation(
    payload: SaveQuotationRequest,
    db: Session = Depends(
        get_db
    ),
    current_user: dict[str, Any] = Depends(
        get_current_user
    ),
):
    if payload.status == "SAVED":
        _validate_saved_quotation(
            payload.data
        )

    fields = (
        _extract_search_fields(
            payload.data
        )
    )

    owner_user_id = (
        _current_user_id(
            current_user
        )
    )

    creator_name = (
        get_user_display_name(
            current_user
        )
    )

    creator_email = (
        get_user_primary_email(
            current_user
        )
    )

    record = SavedQuotation(
        status=payload.status,
        owner_user_id=
            owner_user_id,
        created_by_name=
            creator_name
            or None,
        created_by_email=
            creator_email
            or None,
        quotation_data=
            payload.data.model_dump(
                mode="json"
            ),
        **fields,
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    return _detail(
        record
    )


@router.get(
    "",
    response_model=
        QuotationListResponse,
)
def list_quotations(
    q: str | None = Query(
        default=None,
        description=(
            "Search quotation number, "
            "customer, company, project "
            "or creator."
        ),
    ),
    quotation_status:
        QuotationStatus | None = Query(
            default=None,
            alias="status",
        ),
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
    ),
    db: Session = Depends(
        get_db
    ),
    current_user: dict[str, Any] = Depends(
        get_current_user
    ),
):
    statement = select(
        SavedQuotation
    )

    # Normal users can see only quotations they originally created.
    # Admin/Super Admin can see quotations created by everyone.
    if not is_admin_user(
        current_user
    ):
        statement = (
            statement.where(
                SavedQuotation
                .owner_user_id
                == _current_user_id(
                    current_user
                )
            )
        )

    if quotation_status:
        statement = (
            statement.where(
                SavedQuotation.status
                == quotation_status
            )
        )

    search_text = _clean(
        q
    )

    if search_text:
        pattern = (
            f"%{search_text}%"
        )

        search_filters = [
            SavedQuotation
            .quote_number
            .ilike(pattern),
            SavedQuotation
            .customer_name
            .ilike(pattern),
            SavedQuotation
            .customer_company
            .ilike(pattern),
            SavedQuotation
            .project_name
            .ilike(pattern),
        ]

        # Creator search is particularly useful to Admin.
        if is_admin_user(
            current_user
        ):
            search_filters.extend(
                [
                    SavedQuotation
                    .created_by_name
                    .ilike(pattern),
                    SavedQuotation
                    .created_by_email
                    .ilike(pattern),
                ]
            )

        statement = (
            statement.where(
                or_(
                    *search_filters
                )
            )
        )

    statement = (
        statement
        .order_by(
            desc(
                SavedQuotation
                .updated_at
            )
        )
        .limit(limit)
    )

    records = list(
        db.scalars(
            statement
        ).all()
    )

    items = [
        _summary(record)
        for record in records
    ]

    return QuotationListResponse(
        items=items,
        total=len(items),
    )


@router.get(
    "/{quotation_id}",
    response_model=
        SavedQuotationResponse,
)
def get_quotation(
    quotation_id: int,
    db: Session = Depends(
        get_db
    ),
    current_user: dict[str, Any] = Depends(
        get_current_user
    ),
):
    return _detail(
        _get_accessible_record(
            quotation_id,
            db,
            current_user,
        )
    )


@router.put(
    "/{quotation_id}",
    response_model=
        SavedQuotationResponse,
)
def update_quotation(
    quotation_id: int,
    payload: SaveQuotationRequest,
    db: Session = Depends(
        get_db
    ),
    current_user: dict[str, Any] = Depends(
        get_current_user
    ),
):
    record = (
        _get_accessible_record(
            quotation_id,
            db,
            current_user,
        )
    )

    if payload.status == "SAVED":
        _validate_saved_quotation(
            payload.data
        )

    fields = (
        _extract_search_fields(
            payload.data
        )
    )

    record.status = (
        payload.status
    )

    # Ownership and creator identity intentionally never change here.
    # If an Admin edits another user's quotation, the original creator
    # remains visible as the creator.
    record.quotation_data = (
        payload.data.model_dump(
            mode="json"
        )
    )

    record.quote_number = (
        fields[
            "quote_number"
        ]
    )

    record.customer_name = (
        fields[
            "customer_name"
        ]
    )

    record.customer_company = (
        fields[
            "customer_company"
        ]
    )

    record.project_name = (
        fields[
            "project_name"
        ]
    )

    record.quote_date = (
        fields[
            "quote_date"
        ]
    )

    record.notes = (
        fields[
            "notes"
        ]
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    return _detail(
        record
    )


@router.delete(
    "/{quotation_id}",
    response_model=
        DeleteQuotationResponse,
)
def delete_quotation(
    quotation_id: int,
    db: Session = Depends(
        get_db
    ),
    current_user: dict[str, Any] = Depends(
        get_current_user
    ),
):
    record = (
        _get_accessible_record(
            quotation_id,
            db,
            current_user,
        )
    )

    db.delete(record)
    db.commit()

    return DeleteQuotationResponse(
        id=quotation_id,
    )
