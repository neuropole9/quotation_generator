import os

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.db import Base, engine
from app.models.saved_quotation import SavedQuotation  # noqa: F401
from app.routes.health import router as health_router
from app.routes.quotation import router as quotation_router
from app.routes.saved_quotations import router as saved_quotations_router
from app.routes.templates import router as templates_router
from app.services.pdf_import_service import extract_products_from_pdf

from app.routes.full_quotation_import import router as full_quotation_import_router


def _allowed_origins() -> list[str]:
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    configured = os.getenv(
        "ALLOWED_ORIGINS",
        "",
    )

    if configured:
        origins.extend(
            origin.strip().rstrip("/")
            for origin in configured.split(",")
            if origin.strip()
        )

    # Preserve order while removing duplicates.
    return list(
        dict.fromkeys(origins)
    )


# Register every SQLAlchemy model before create_all() is called.
# For local development this creates quotation_generator.db automatically.
# In production it uses DATABASE_URL from app/db.py.
Base.metadata.create_all(
    bind=engine,
)


app = FastAPI(
    title="Quotation Generator API",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    # Vercel production/preview deployments use *.vercel.app.
    # Add a custom production domain through ALLOWED_ORIGINS when needed.
    allow_origin_regex=os.getenv(
        "ALLOWED_ORIGIN_REGEX",
        r"https://.*\.vercel\.app",
    ),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "Content-Disposition",
    ],
)


app.include_router(
    health_router,
    prefix="/api",
)

app.include_router(
    templates_router,
    prefix="/api",
)

app.include_router(
    quotation_router,
    prefix="/api",
)

app.include_router(
    saved_quotations_router,
    prefix="/api",
)
app.include_router(full_quotation_import_router, prefix="/api")

@app.get("/")
def root():
    return {
        "message":
            "Quotation Generator API is running",
        "docs":
            "/docs",
    }


@app.post(
    "/api/quotation/import-pdf"
)
async def import_quotation_pdf(
    file: UploadFile = File(...),
):
    filename = file.filename or ""

    if not filename.lower().endswith(
        ".pdf"
    ):
        raise HTTPException(
            status_code=400,
            detail=
                "Please upload a PDF file.",
        )

    pdf_bytes = await file.read()

    if not pdf_bytes:
        raise HTTPException(
            status_code=400,
            detail=
                "The uploaded PDF is empty.",
        )

    # 15 MB safety limit.
    max_size = (
        15
        * 1024
        * 1024
    )

    if len(pdf_bytes) > max_size:
        raise HTTPException(
            status_code=400,
            detail=
                "PDF must be smaller than 15 MB.",
        )

    try:
        return (
            extract_products_from_pdf(
                pdf_bytes
            )
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to extract products "
                "from the uploaded PDF."
            ),
        ) from exc
