from __future__ import annotations

import io
import re
from typing import Any

import pdfplumber


MODEL_HEADERS = {
    "model",
    "modelno",
    "modelnumber",
    "model#",
    "partno",
    "partnumber",
    "part#",
    "sku",
    "itemcode",
    "productcode",
}

DESCRIPTION_HEADERS = {
    "description",
    "product",
    "productdescription",
    "productdetails",
    "item",
    "itemdescription",
    "details",
    "particulars",
}

UNIT_HEADERS = {
    "unit",
    "uom",
}

QUANTITY_HEADERS = {
    "qty",
    "quantity",
}

PRICE_HEADERS = {
    "price",
    "rate",
    "unitprice",
    "unitrate",
}

TOTAL_HEADERS = {
    "total",
    "amount",
    "lineamount",
    "linetotal",
}

SERIAL_HEADERS = {
    "sno",
    "slno",
    "serial",
    "serialno",
    "srno",
    "no",
}


def _clean_cell(value: Any) -> str:
    if value is None:
        return ""

    text = str(value)
    text = text.replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n+", " ", text)
    return text.strip()


def _header_key(value: Any) -> str:
    text = _clean_cell(value).lower()

    # Normalize common punctuation and whitespace.
    text = text.replace("&", "and")
    text = re.sub(r"[\s._:/\\\-]+", "", text)

    return text


def _number(value: Any, default: float = 0.0) -> float:
    text = _clean_cell(value)

    if not text:
        return default

    # Keep digits, minus and decimal point only.
    cleaned = re.sub(
        r"[^0-9.\-]",
        "",
        text.replace(",", ""),
    )

    if cleaned in {"", "-", ".", "-."}:
        return default

    try:
        return float(cleaned)
    except ValueError:
        return default


def _first_index(
    normalized_headers: list[str],
    candidates: set[str],
) -> int | None:
    for index, header in enumerate(normalized_headers):
        if header in candidates:
            return index

    return None


def _looks_like_product_header(row: list[Any]) -> bool:
    headers = [_header_key(cell) for cell in row]

    description_index = _first_index(
        headers,
        DESCRIPTION_HEADERS,
    )
    qty_index = _first_index(
        headers,
        QUANTITY_HEADERS,
    )

    # A product table normally has Description and Qty.
    return (
        description_index is not None
        and qty_index is not None
    )


def _column_map(header_row: list[Any]) -> dict[str, int | None]:
    headers = [_header_key(cell) for cell in header_row]

    return {
        "serial": _first_index(headers, SERIAL_HEADERS),
        "modelNumber": _first_index(headers, MODEL_HEADERS),
        "description": _first_index(headers, DESCRIPTION_HEADERS),
        "unit": _first_index(headers, UNIT_HEADERS),
        "quantity": _first_index(headers, QUANTITY_HEADERS),
        "unitPrice": _first_index(headers, PRICE_HEADERS),
        "total": _first_index(headers, TOTAL_HEADERS),
    }


def _cell(row: list[Any], index: int | None) -> str:
    if index is None:
        return ""

    if index < 0 or index >= len(row):
        return ""

    return _clean_cell(row[index])


def _row_is_header(row: list[Any]) -> bool:
    return _looks_like_product_header(row)


def _is_probable_product_row(
    row: list[Any],
    columns: dict[str, int | None],
) -> bool:
    description = _cell(
        row,
        columns["description"],
    )

    model_number = _cell(
        row,
        columns["modelNumber"],
    )

    quantity_text = _cell(
        row,
        columns["quantity"],
    )

    if not description and not model_number:
        return False

    if _row_is_header(row):
        return False

    # Skip total/subtotal rows.
    combined = " ".join(
        _clean_cell(cell).lower()
        for cell in row
        if cell is not None
    )

    if any(
        token in combined
        for token in (
            "grand total",
            "subtotal",
            "sub total",
            "gst 18",
            "gst18",
            "tax total",
        )
    ):
        return False

    # Most real product rows have a quantity. We still allow blank qty
    # when a model number is present, but default qty to 1 later.
    if quantity_text:
        return True

    return bool(model_number and description)


def _product_from_row(
    row: list[Any],
    columns: dict[str, int | None],
) -> dict[str, Any] | None:
    if not _is_probable_product_row(
        row,
        columns,
    ):
        return None

    model_number = _cell(
        row,
        columns["modelNumber"],
    )

    description = _cell(
        row,
        columns["description"],
    )

    unit = _cell(
        row,
        columns["unit"],
    )

    quantity_text = _cell(
        row,
        columns["quantity"],
    )

    unit_price_text = _cell(
        row,
        columns["unitPrice"],
    )

    total_text = _cell(
        row,
        columns["total"],
    )

    quantity = _number(
        quantity_text,
        1.0,
    )

    if quantity <= 0:
        quantity = 1.0

    unit_price = _number(
        unit_price_text,
        0.0,
    )

    # If price is missing but Total exists, derive the unit price.
    if (
        unit_price <= 0
        and total_text
        and quantity > 0
    ):
        total_value = _number(
            total_text,
            0.0,
        )

        if total_value > 0:
            unit_price = total_value / quantity

    return {
        "modelNumber": model_number,
        "description": description,
        "unit": unit or "Nos",
        "quantity": quantity,
        "unitPrice": unit_price,
    }


def _dedupe_products(
    products: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    seen: set[tuple[str, str, float, str]] = set()

    for product in products:
        key = (
            str(product.get("modelNumber", "")).strip().lower(),
            str(product.get("description", "")).strip().lower(),
            float(product.get("quantity", 0) or 0),
            str(product.get("unit", "")).strip().lower(),
        )

        if key in seen:
            continue

        seen.add(key)
        result.append(product)

    return result


def extract_products_from_pdf(
    pdf_bytes: bytes,
) -> dict[str, Any]:
    """
    Extract product rows from a quotation / BOQ PDF.

    Supported columns include:
    S.No, Model Number / Model No / Part No / SKU,
    Description, Unit, Qty, Price / Rate, Total / Amount.

    Missing Model Number is returned as an empty string.
    Missing Price defaults to 0 unless it can be derived
    from Total / Qty.
    """

    if not pdf_bytes:
        raise ValueError("The uploaded PDF is empty.")

    products: list[dict[str, Any]] = []
    page_count = 0
    tables_found = 0
    product_tables_found = 0
    pages_with_text = 0

    with pdfplumber.open(
        io.BytesIO(pdf_bytes)
    ) as pdf:
        page_count = len(pdf.pages)

        for page in pdf.pages:
            page_text = (
                page.extract_text()
                or ""
            ).strip()

            if page_text:
                pages_with_text += 1

            tables = (
                page.extract_tables()
                or []
            )

            tables_found += len(tables)

            for table in tables:
                if (
                    not table
                    or len(table) < 2
                ):
                    continue

                header_index = None

                # Sometimes the first extracted row is not the real header.
                for candidate_index, row in enumerate(
                    table[:5]
                ):
                    if _looks_like_product_header(
                        row
                    ):
                        header_index = candidate_index
                        break

                if header_index is None:
                    continue

                product_tables_found += 1

                header_row = table[
                    header_index
                ]

                columns = _column_map(
                    header_row
                )

                for row in table[
                    header_index + 1 :
                ]:
                    product = _product_from_row(
                        row,
                        columns,
                    )

                    if product is not None:
                        products.append(
                            product
                        )

    products = _dedupe_products(
        products
    )

    return {
        "products": products,
        "meta": {
            "pageCount": page_count,
            "tablesFound": tables_found,
            "productTablesFound": product_tables_found,
            "pagesWithText": pages_with_text,
        },
    }
