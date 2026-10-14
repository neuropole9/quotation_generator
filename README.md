# Quotation Generator — Full V1

A focused quotation generator with 4 selectable templates, one shared company header/footer, customer and project details, dynamic products, per-line GST, automatic totals, live A4 preview, and backend-generated PDF downloads.

## Included

- **Frontend:** React + Vite + TypeScript
- **Backend:** FastAPI + ReportLab
- 4 templates: Company Classic, Corporate, Modern, Compact
- Template switching without losing entered quotation data
- Common logo/header/footer across all templates
- Company, customer, quotation, site and optional technical/project fields
- Add/remove products
- Qty × Rate calculation
- GST rates: 0%, 5%, 12%, 18%, 28%
- Mixed-GST breakup and Grand Total
- Indian `en-IN` currency formatting in the browser preview
- Live A4 preview
- Logo image upload (PNG/JPG/WebP, max 2 MB in the UI)
- Terms & conditions + notes
- Real backend `/api/quotation/pdf` PDF download
- No login, database, CRM, quotation tracking or employee dashboards

> Note: the PDF renderer uses the portable text prefix `INR` instead of the ₹ glyph because ReportLab's built-in Helvetica font does not contain the Indian Rupee symbol. The browser live preview uses ₹ normally. This avoids bundling font files into the project.

## Structure

```text
quotation-generator/
├── frontend/
│   └── src/
│       ├── components/
│       ├── data/
│       ├── pages/
│       ├── types/
│       └── utils/
└── backend/
    ├── app/
    │   ├── models/
    │   ├── routes/
    │   └── services/
    └── tests/
```

## Run on Windows PowerShell

### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Backend API: `http://127.0.0.1:8000`  
Swagger: `http://127.0.0.1:8000/docs`

### 2. Frontend

Open a second PowerShell terminal:

```powershell
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

Vite proxies `/api` to the FastAPI backend during local development.

## Production build

```powershell
cd frontend
npm install
npm run build
```

Deploy the generated `frontend/dist` as your static frontend and run FastAPI separately. For production, set the frontend API origin/reverse proxy according to your hosting environment.
