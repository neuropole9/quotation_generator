from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.health import router as health_router
from app.routes.quotation import router as quotation_router
from app.routes.templates import router as templates_router
from fastapi import File, HTTPException, UploadFile

from app.services.pdf_import_service import (
    extract_products_from_pdf,
)

app = FastAPI(title="Quotation Generator API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(health_router, prefix="/api")
app.include_router(templates_router, prefix="/api")
app.include_router(quotation_router, prefix="/api")

@app.get("/")
def root():
    return {"message":"Quotation Generator API is running","docs":"/docs"}
@app.post("/api/quotation/import-pdf")
async def import_quotation_pdf(
    file: UploadFile = File(...),
):
    # ---------------------------------------------
    # Validate file type
    # ---------------------------------------------

    filename = (
        file.filename
        or ""
    )

    if not filename.lower().endswith(
        ".pdf"
    ):
        raise HTTPException(
            status_code=400,
            detail="Please upload a PDF file.",
        )

    # ---------------------------------------------
    # Read uploaded PDF
    # ---------------------------------------------

    pdf_bytes = await file.read()

    if not pdf_bytes:
        raise HTTPException(
            status_code=400,
            detail="The uploaded PDF is empty.",
        )

    # 15 MB safety limit
    max_size = (
        15
        * 1024
        * 1024
    )

    if len(pdf_bytes) > max_size:
        raise HTTPException(
            status_code=400,
            detail="PDF must be smaller than 15 MB.",
        )

    # ---------------------------------------------
    # Extract products
    # ---------------------------------------------

    try:
        result = (
            extract_products_from_pdf(
                pdf_bytes,
            )
        )

        return result

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to extract products "
                "from the uploaded PDF."
            ),
        ) from exc
