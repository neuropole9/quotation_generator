from fastapi import APIRouter
from fastapi.responses import Response
from app.models.quotation import QuotationData
from app.services.pdf_service import build_pdf

router = APIRouter(prefix="/quotation", tags=["quotation"])

@router.post("/pdf")
def generate_pdf(payload: QuotationData):
    pdf_bytes, filename = build_pdf(payload)
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{filename}"'})
