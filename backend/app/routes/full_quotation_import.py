from __future__ import annotations

import logging

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.full_quotation_import_service import (
    extract_full_quotation_from_pdf,
)


logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/quotation",
    tags=["full quotation import"],
)


@router.post("/import-full-pdf")
async def import_full_quotation_pdf(
    file: UploadFile = File(...),
):
    """
    Import a COMPLETE quotation PDF.

    This endpoint is intentionally separate from the existing
    /quotation/import-pdf endpoint used for part-wise product imports.
    """

    filename = file.filename or ""

    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a PDF file.",
        )

    pdf_bytes = await file.read()

    if not pdf_bytes:
        raise HTTPException(
            status_code=400,
            detail="The uploaded PDF is empty.",
        )

    max_size = 15 * 1024 * 1024

    if len(pdf_bytes) > max_size:
        raise HTTPException(
            status_code=400,
            detail="PDF must be smaller than 15 MB.",
        )

    try:
        result = extract_full_quotation_from_pdf(
            pdf_bytes
        )
    except Exception as exc:
        logger.exception(
            "Full quotation PDF import failed for %s",
            filename,
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to extract the complete quotation "
                f"from the uploaded PDF: {type(exc).__name__}: {exc}"
            ),
        ) from exc

    return result
