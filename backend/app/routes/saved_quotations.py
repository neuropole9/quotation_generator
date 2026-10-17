from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, or_, select
from sqlalchemy.orm import Session

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
            record.quote_number,
        customerName=
            record.customer_name,
        customerCompany=
            record.customer_company,
        projectName=
            record.project_name,
        quoteDate=
            record.quote_date,
        ownerUserId=
            record.owner_user_id,
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

    record = SavedQuotation(
        status=payload.status,
        owner_user_id=
            _clean(
                payload.ownerUserId
            )
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
            "customer, company or project."
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
):
    statement = select(
        SavedQuotation
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

        statement = (
            statement.where(
                or_(
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
):
    return _detail(
        _get_record(
            quotation_id,
            db,
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
):
    record = _get_record(
        quotation_id,
        db,
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

    record.owner_user_id = (
        _clean(
            payload.ownerUserId
        )
        or record.owner_user_id
    )

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
):
    record = _get_record(
        quotation_id,
        db,
    )

    db.delete(record)
    db.commit()

    return DeleteQuotationResponse(
        id=quotation_id,
    )
