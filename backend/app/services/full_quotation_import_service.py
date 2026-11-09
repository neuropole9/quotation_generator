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
    "descriptionoftheitem",  # Generated Product BOQ heading
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
    "price(inrs)",  # Generated Abstract / BOQ heading
    "rate(inrs)",
}

TOTAL_HEADERS = {
    "total",
    "amount",
    "lineamount",
    "linetotal",
    "total(inrs)",  # Generated BOQ heading
}

SERIAL_HEADERS = {
    "sno",
    "slno",
    "serial",
    "serialno",
    "srno",
    "no",
}


# =========================================================
# BASIC CLEANING
# =========================================================

def _clean_cell(value: Any) -> str:
    if value is None:
        return ""

    text = str(value)
    text = text.replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n+", " ", text)
    return text.strip()


def _clean_multiline(value: Any) -> str:
    if value is None:
        return ""

    text = str(value).replace("\r", "\n")
    lines = [
        re.sub(r"[ \t]+", " ", line).strip()
        for line in text.splitlines()
    ]
    return "\n".join(line for line in lines if line)


def _empty_dash(value: Any) -> str:
    text = _clean_cell(value)
    if text in {"—", "-", "–"}:
        return ""
    return text


def _header_key(value: Any) -> str:
    text = _clean_cell(value).lower()
    text = text.replace("&", "and")
    text = re.sub(r"[\s._:/\\\-]+", "", text)
    return text


def _number(value: Any, default: float = 0.0) -> float:
    text = _clean_cell(value)

    if not text:
        return default

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


def _safe_id(value: str, fallback: str) -> str:
    key = re.sub(
        r"[^a-z0-9]+",
        "-",
        value.lower().strip(),
    ).strip("-")

    return f"import-{key or fallback}"


def _sanitize_table(
    table: Any,
) -> list[list[Any]]:
    """
    pdfplumber can return partially malformed table structures for some PDFs.
    Normalize every table to a clean list-of-rows so one unusual row cannot
    crash the complete quotation import.
    """
    if not isinstance(table, list):
        return []

    cleaned: list[list[Any]] = []

    for row in table:
        if not isinstance(row, (list, tuple)):
            continue

        cleaned.append(list(row))

    return cleaned


def _safe_page_text(
    page: Any,
) -> str:
    try:
        return (
            page.extract_text(
                x_tolerance=2,
                y_tolerance=3,
            )
            or ""
        ).strip()
    except Exception:
        try:
            return (
                page.extract_text()
                or ""
            ).strip()
        except Exception:
            return ""


def _safe_page_tables(
    page: Any,
) -> list[list[list[Any]]]:
    """
    Try normal table extraction first, then a line-based strategy.
    Return only sanitized table structures.
    """
    raw_tables: Any = []

    try:
        raw_tables = (
            page.extract_tables()
            or []
        )
    except Exception:
        try:
            raw_tables = (
                page.extract_tables(
                    {
                        "vertical_strategy": "lines",
                        "horizontal_strategy": "lines",
                        "intersection_tolerance": 5,
                        "snap_tolerance": 3,
                        "join_tolerance": 3,
                    }
                )
                or []
            )
        except Exception:
            raw_tables = []

    result: list[list[list[Any]]] = []

    if not isinstance(raw_tables, list):
        return result

    for table in raw_tables:
        cleaned = _sanitize_table(
            table
        )

        if cleaned:
            result.append(
                cleaned
            )

    return result


# =========================================================
# PRODUCT TABLE HELPERS
# =========================================================

def _looks_like_product_header(row: list[Any] | None) -> bool:
    if not isinstance(row, (list, tuple)):
        return False

    headers = [_header_key(cell) for cell in row]

    description_index = _first_index(
        headers,
        DESCRIPTION_HEADERS,
    )
    qty_index = _first_index(
        headers,
        QUANTITY_HEADERS,
    )

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

    if quantity_text:
        return True

    return bool(model_number and description)


def _product_from_row(
    row: list[Any],
    columns: dict[str, int | None],
    *,
    product_id: str,
    abstract_item_id: str,
    gst_rate: float,
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

    description = _clean_multiline(
        row[columns["description"]]
        if columns["description"] is not None
        and columns["description"] < len(row)
        else ""
    ).replace("\n", " ")

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
        "id": product_id,
        "modelNumber": model_number,
        "imageDataUrl": "",
        "abstractItemId": abstract_item_id,
        "description": description,
        "unit": _empty_dash(unit) or "Nos",
        "quantity": quantity,
        "unitPrice": unit_price,
        "gstRate": gst_rate,
        "customValues": {},
    }


def _dedupe_products(
    products: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    seen: set[tuple[str, str, float, str, str]] = set()

    for product in products:
        key = (
            str(product.get("abstractItemId", "")).strip().lower(),
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


# =========================================================
# PART / ABSTRACT HELPERS
# =========================================================

def _normalize_part_label(value: Any) -> str:
    text = _clean_cell(value).upper()

    text = re.sub(
        r"\s*-\s*CONTINUED.*$",
        "",
        text,
    ).strip()

    match = re.search(
        r"\bPART\s+([A-Z0-9]+)\b",
        text,
    )

    if not match:
        return ""

    return f"PART {match.group(1)}"


def _extract_abstract_items(
    tables: list[list[list[Any]]],
) -> tuple[list[dict[str, Any]], dict[str, str]]:
    abstract_items: list[dict[str, Any]] = []
    part_to_id: dict[str, str] = {}

    for raw_table in tables:
        table = _sanitize_table(
            raw_table
        )

        if not table or len(table) < 2:
            continue

        first = [
            _header_key(cell)
            for cell in table[0]
        ]

        has_parts = any(
            value in {"parts", "part"}
            for value in first
        )
        has_description = any(
            value in DESCRIPTION_HEADERS
            for value in first
        )
        has_price = any(
            value in PRICE_HEADERS
            for value in first
        )

        if not (
            has_parts
            and has_description
            and has_price
        ):
            continue

        part_index = next(
            (
                i
                for i, value in enumerate(first)
                if value in {"parts", "part"}
            ),
            None,
        )
        description_index = _first_index(
            first,
            DESCRIPTION_HEADERS,
        )
        price_index = _first_index(
            first,
            PRICE_HEADERS,
        )

        if (
            part_index is None
            or description_index is None
            or price_index is None
        ):
            continue

        for row in table[1:]:
            if not row:
                continue

            part_label = _normalize_part_label(
                row[part_index]
                if part_index < len(row)
                else ""
            )

            description = _clean_cell(
                row[description_index]
                if description_index < len(row)
                else ""
            )

            price = _number(
                row[price_index]
                if price_index < len(row)
                else "",
                0.0,
            )

            if not part_label:
                continue

            if not description:
                continue

            item_id = _safe_id(
                part_label,
                f"part-{len(abstract_items) + 1}",
            )

            part_to_id[part_label] = item_id

            abstract_items.append(
                {
                    "id": item_id,
                    "description": description,
                    "price": price,
                }
            )

        if abstract_items:
            break

    return abstract_items, part_to_id


def _detect_product_table_part(
    table: list[list[Any]],
) -> str:
    if not table:
        return ""

    for row in table[:3]:
        if not isinstance(row, (list, tuple)):
            continue

        for cell in row:
            part = _normalize_part_label(
                cell
            )
            if part:
                return part

    return ""


# =========================================================
# PAGE 1 HEADER DATA
# =========================================================

def _collect_label_values(
    tables: list[list[list[Any]]],
) -> dict[str, str]:
    values: dict[str, str] = {}

    known_labels = {
        "clientname": "clientName",
        "clientnumber": "clientNumber",
        "clientaddress": "clientAddress",
        "clientgstno": "clientGstNo",
        "clientemail": "clientEmail",
        "sitelocation": "siteLocation",
        "projectname": "projectName",
        "mepdetails": "mepDetails",
        "qtno": "quoteNumber",
        "quotationno": "quoteNumber",
        "quotationnumber": "quoteNumber",
        "qtdate": "quoteDate",
        "quotationdate": "quoteDate",
        "qtdetails": "quoteDetails",
        "quotationdetails": "quoteDetails",
    }

    for raw_table in tables:
        table = _sanitize_table(
            raw_table
        )

        for row in table:
            if not row:
                continue

            index = 0
            while index < len(row):
                key = _header_key(
                    row[index]
                )

                mapped = known_labels.get(
                    key
                )

                if mapped:
                    value = ""

                    if index + 1 < len(row):
                        value = _empty_dash(
                            row[index + 1]
                        )

                    values[mapped] = value
                    index += 2
                    continue

                index += 1

    return values



def _extract_header_values_from_text(
    page_texts: list[str],
) -> dict[str, str]:
    """
    Fallback for PDFs where the visual table is not extracted as a table.
    It targets the labels used by this quotation application's first page.
    """
    if not page_texts:
        return {}

    text = page_texts[0]
    lines = [
        re.sub(r"\s+", " ", line).strip()
        for line in text.splitlines()
        if line.strip()
    ]

    patterns = {
        "clientName": r"Client\s+Name\s+(.+?)(?=\s+Project\s+Name|$)",
        "clientNumber": r"Client\s+Number\s+(.+?)(?=\s+MEP\s+Details|$)",
        "clientAddress": r"Client\s+Address\s+(.+)$",
        "clientGstNo": r"Client\s+GST\s+No\.?\s+(.+)$",
        "clientEmail": r"Client\s+Email\s+(.+)$",
        "siteLocation": r"Site\s+Location\s+(.+)$",
        "quoteNumber": r"(?:Qt\.?\s*No|Quotation\s+No(?:\.|:)?|Quotation\s+Number)\s*:?\s*(.+)$",
        "quoteDate": r"(?:Qt\.?\s*Date|Quotation\s+Date)\s*:?\s*(.+)$",
        "quoteDetails": r"(?:Qt\.?\s*Details|Quotation\s+Details)\s*:?\s*(.+)$",
    }

    result: dict[str, str] = {}

    for line in lines:
        for key, pattern in patterns.items():
            if key in result:
                continue

            match = re.search(
                pattern,
                line,
                flags=re.IGNORECASE,
            )

            if match:
                value = _empty_dash(
                    match.group(1)
                )

                if value:
                    result[key] = value

        if (
            "projectName" not in result
            and re.search(
                r"\bProject\s+Name\b",
                line,
                flags=re.IGNORECASE,
            )
        ):
            match = re.search(
                r"Project\s+Name\s+(.+)$",
                line,
                flags=re.IGNORECASE,
            )
            if match:
                result["projectName"] = _empty_dash(
                    match.group(1)
                )

        if (
            "mepDetails" not in result
            and re.search(
                r"\bMEP\s+Details\b",
                line,
                flags=re.IGNORECASE,
            )
        ):
            match = re.search(
                r"MEP\s+Details\s+(.+)$",
                line,
                flags=re.IGNORECASE,
            )
            if match:
                result["mepDetails"] = _empty_dash(
                    match.group(1)
                )

    return result

# =========================================================
# TOTALS / GST
# =========================================================

def _extract_totals(
    tables: list[list[list[Any]]],
) -> dict[str, float]:
    totals = {
        "subtotal": 0.0,
        "gstRate": 0.0,
        "gstAmount": 0.0,
        "grandTotal": 0.0,
    }

    for table in tables:
        if not table:
            continue

        for row in table:
            if not row:
                continue

            combined = " ".join(
                _clean_cell(cell)
                for cell in row
                if cell is not None
            ).strip()

            lowered = combined.lower()

            numeric_values = [
                _number(cell, 0.0)
                for cell in row
                if _clean_cell(cell)
            ]
            numeric_values = [
                number
                for number in numeric_values
                if number > 0
            ]

            value = (
                numeric_values[-1]
                if numeric_values
                else 0.0
            )

            if (
                "grand total" in lowered
                and value
            ):
                totals["grandTotal"] = value

            elif (
                re.search(
                    r"\bgst\s*18\s*%",
                    lowered,
                )
                and value
            ):
                totals["gstRate"] = 18.0
                totals["gstAmount"] = value

            elif (
                lowered.startswith("subtotal")
                and value
            ):
                totals["subtotal"] = value

    if (
        totals["gstRate"] <= 0
        and totals["subtotal"] > 0
        and totals["gstAmount"] > 0
    ):
        totals["gstRate"] = round(
            (
                totals["gstAmount"]
                / totals["subtotal"]
            )
            * 100,
            2,
        )

    return totals


# =========================================================
# TERMS
# =========================================================

def _extract_terms(
    page_texts: list[str],
) -> list[dict[str, Any]]:
    relevant_lines: list[str] = []

    for page_text in page_texts:
        if (
            "TERMS & CONDITIONS"
            not in page_text.upper()
        ):
            continue

        lines = [
            re.sub(
                r"\s+",
                " ",
                line,
            ).strip()
            for line in page_text.splitlines()
        ]

        started = False

        for line in lines:
            if not line:
                continue

            upper = line.upper()

            if upper == "TERMS & CONDITIONS":
                started = True
                continue

            if not started:
                continue

            if upper.startswith(
                "ALPHANUMERIC INNOVATIONS PRIVATE LIMITED"
            ):
                break

            if upper.startswith(
                "WE HOPE YOU WILL FIND OUR OFFER"
            ):
                break

            if upper.startswith(
                "BANK DETAILS"
            ):
                break

            if upper.startswith(
                "AUTO GENERATED QUOTE"
            ):
                break

            if upper.startswith(
                "320, EAST AVENUE"
            ):
                break

            if (
                "WWW.ANIPLGROUP.COM"
                in upper
            ):
                break

            relevant_lines.append(
                line
            )

    terms: list[dict[str, Any]] = []
    current_number: int | None = None
    current_lines: list[str] = []

    def flush() -> None:
        nonlocal current_number
        nonlocal current_lines

        if (
            current_number is None
            or not current_lines
        ):
            current_number = None
            current_lines = []
            return

        text = " ".join(
            current_lines
        ).strip()

        if text:
            terms.append(
                {
                    "id": f"import-term-{current_number}",
                    "text": text,
                    "selected": True,
                    "isCustom": True,
                }
            )

        current_number = None
        current_lines = []

    for line in relevant_lines:
        numbered = re.match(
            r"^(\d{1,2})\.\s*(.*)$",
            line,
        )

        if numbered:
            flush()
            current_number = int(
                numbered.group(1)
            )
            current_lines = [
                numbered.group(2).strip()
            ]
            continue

        # Continue the current term, including AMC a-g subpoints.
        if current_number is not None:
            current_lines.append(line)

    flush()

    return terms


# =========================================================
# BANK / COMPANY DATA
# =========================================================

def _extract_bank_details(
    tables: list[list[list[Any]]],
) -> dict[str, str]:
    bank = {
        "accountName": "",
        "accountDetails": "",
        "ifscCode": "",
        "bankName": "",
    }

    labels = {
        "accountname": "accountName",
        "accountnumber": "accountDetails",
        "ifsccode": "ifscCode",
        "branchname": "bankName",
        "bankname": "bankName",
    }

    for table in tables:
        for row in table:
            if (
                not row
                or len(row) < 2
            ):
                continue

            key = _header_key(
                row[0]
            )
            mapped = labels.get(
                key
            )

            if not mapped:
                continue

            bank[mapped] = _empty_dash(
                row[1]
            )

    return bank


def _extract_company_from_text(
    page_texts: list[str],
) -> dict[str, str]:
    result = {
        "name": "",
        "address": "",
        "phone": "",
        "email": "",
        "gstNo": "",
        "website": "",
        "footerLine1": "",
        "footerLine2": "",
    }

    joined = "\n".join(
        page_texts
    )

    company_match = re.search(
        r"(?im)^ALPHANUMERIC INNOVATIONS PRIVATE LIMITED$",
        joined,
    )

    if company_match:
        result["name"] = (
            "ALPHANUMERIC INNOVATIONS PRIVATE LIMITED"
        )
        result["footerLine1"] = (
            "ALPHANUMERIC INNOVATIONS PRIVATE LIMITED"
        )

    email_match = re.search(
        r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}",
        joined,
    )
    if email_match:
        result["email"] = (
            email_match.group(0)
        )

    website_match = re.search(
        r"\bwww\.[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
        joined,
    )
    if website_match:
        result["website"] = (
            website_match.group(0)
        )

    address_match = re.search(
        (
            r"(?im)^320,\s*East Avenue,\s*Fifth Floor,"
            r".*?Telangana\s*500081$"
        ),
        joined,
    )

    if address_match:
        result["address"] = (
            re.sub(
                r"\s+",
                " ",
                address_match.group(0),
            ).strip()
        )

    footer_parts = [
        value
        for value in (
            result["address"],
            result["website"],
            result["email"],
        )
        if value
    ]

    if footer_parts:
        result["footerLine2"] = (
            " | ".join(
                footer_parts
            )
        )

    return result


# =========================================================
# NOTES
# =========================================================

def _extract_notes(
    page_texts: list[str],
) -> str:
    for page_text in page_texts:
        match = re.search(
            r"(?im)^Note:\s*(.+)$",
            page_text,
        )
        if match:
            return re.sub(
                r"\s+",
                " ",
                match.group(1),
            ).strip()

    return ""


# =========================================================
# MAIN EXTRACTION
# =========================================================

def extract_full_quotation_from_pdf(
    pdf_bytes: bytes,
) -> dict[str, Any]:
    """
    Extract complete quotation data from a text-based quotation PDF.

    This parser is intentionally optimized for the quotation format generated
    by this application while remaining tolerant of common table-label changes.

    It extracts:
    - client / project / quotation fields
    - abstract parts
    - product detail rows across continued pages
    - GST / subtotal / grand total
    - Terms & Conditions
    - bank details
    - company footer details
    """

    if not pdf_bytes:
        raise ValueError(
            "The uploaded PDF is empty."
        )

    page_texts: list[str] = []
    all_tables: list[
        list[list[Any]]
    ] = []

    page_count = 0
    tables_found = 0
    pages_with_text = 0
    product_tables_found = 0

    with pdfplumber.open(
        io.BytesIO(pdf_bytes)
    ) as pdf:
        page_count = len(pdf.pages)

        for page in pdf.pages:
            page_text = _safe_page_text(
                page
            )

            page_texts.append(
                page_text
            )

            if page_text:
                pages_with_text += 1

            tables = _safe_page_tables(
                page
            )

            tables_found += len(
                tables
            )

            all_tables.extend(
                tables
            )

    header_values = (
        _collect_label_values(
            all_tables
        )
    )

    text_header_values = (
        _extract_header_values_from_text(
            page_texts
        )
    )

    for key, value in text_header_values.items():
        if not header_values.get(
            key
        ):
            header_values[
                key
            ] = value

    abstract_items, part_to_id = (
        _extract_abstract_items(
            all_tables
        )
    )

    totals = _extract_totals(
        all_tables
    )

    gst_rate = (
        totals["gstRate"]
        if totals["gstRate"] > 0
        else 18.0
    )

    products: list[
        dict[str, Any]
    ] = []

    product_counter = 0

    for raw_table in all_tables:
        table = _sanitize_table(
            raw_table
        )

        if (
            not table
            or len(table) < 2
        ):
            continue

        header_index: int | None = None

        for candidate_index, row in enumerate(
            table[:5]
        ):
            if _looks_like_product_header(
                row
            ):
                header_index = (
                    candidate_index
                )
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

        part_label = (
            _detect_product_table_part(
                table
            )
        )

        abstract_item_id = (
            part_to_id.get(
                part_label,
                "",
            )
        )

        if (
            part_label
            and not abstract_item_id
        ):
            abstract_item_id = (
                _safe_id(
                    part_label,
                    f"part-{len(abstract_items) + 1}",
                )
            )

            part_to_id[
                part_label
            ] = abstract_item_id

            abstract_items.append(
                {
                    "id": abstract_item_id,
                    "description": part_label,
                    "price": 0.0,
                }
            )

        for row in table[
            header_index + 1 :
        ]:
            product_counter += 1

            product = _product_from_row(
                row,
                columns,
                product_id=(
                    f"import-product-{product_counter}"
                ),
                abstract_item_id=(
                    abstract_item_id
                ),
                gst_rate=gst_rate,
            )

            if product is not None:
                products.append(
                    product
                )

    products = _dedupe_products(
        products
    )

    # Re-number product IDs after de-duplication.
    for index, product in enumerate(
        products,
        start=1,
    ):
        product["id"] = (
            f"import-product-{index}"
        )

    terms = _extract_terms(
        page_texts
    )

    bank = _extract_bank_details(
        all_tables
    )

    company = (
        _extract_company_from_text(
            page_texts
        )
    )

    company.update(
        {
            key: value
            for key, value in bank.items()
            if value
        }
    )

    notes = _extract_notes(
        page_texts
    )

    customer = {
        "name": header_values.get(
            "clientName",
            "",
        ),
        # The PDF has one visible Client Name field. Keep Company aligned with
        # that value so the existing editor is also populated.
        "company": header_values.get(
            "clientName",
            "",
        ),
        "address": header_values.get(
            "clientAddress",
            "",
        ),
        "phone": header_values.get(
            "clientNumber",
            "",
        ),
        "email": header_values.get(
            "clientEmail",
            "",
        ),
        "gstNo": header_values.get(
            "clientGstNo",
            "",
        ),
    }

    quote = {
        "quoteNumber": header_values.get(
            "quoteNumber",
            "",
        ),
        "quoteDate": header_values.get(
            "quoteDate",
            "",
        ),
        "validUntil": "",
        "reference": "",
        "siteLocation": header_values.get(
            "siteLocation",
            "",
        ),
        "projectName": header_values.get(
            "projectName",
            "",
        ),
        "mepDetails": header_values.get(
            "mepDetails",
            "",
        ),
        "quoteDetails": header_values.get(
            "quoteDetails",
            "",
        ),
    }

    warnings: list[str] = []

    if pages_with_text == 0:
        warnings.append(
            "This PDF does not contain machine-readable text. "
            "It may be a scanned/image PDF; OCR support is required for this file."
        )

    if not products:
        warnings.append(
            "No product rows were found in the uploaded PDF."
        )

    if not abstract_items:
        warnings.append(
            "No abstract rows were found in the uploaded PDF."
        )

    if not quote["quoteNumber"]:
        warnings.append(
            "Quotation number could not be detected."
        )

    if not quote["projectName"]:
        warnings.append(
            "Project name could not be detected."
        )

    if not terms:
        warnings.append(
            "Terms & Conditions could not be detected."
        )

    missing_model_count = sum(
        1
        for product in products
        if not str(
            product.get(
                "modelNumber",
                "",
            )
        ).strip()
    )

    if missing_model_count:
        warnings.append(
            f"{missing_model_count} product(s) do not contain a model number."
        )

    legacy_products = [
        {
            "modelNumber": product.get(
                "modelNumber",
                "",
            ),
            "description": product.get(
                "description",
                "",
            ),
            "unit": product.get(
                "unit",
                "Nos",
            ),
            "quantity": product.get(
                "quantity",
                1,
            ),
            "unitPrice": product.get(
                "unitPrice",
                0,
            ),
            "abstractItemId": product.get(
                "abstractItemId",
                "",
            ),
        }
        for product in products
    ]

    return {
        "success": True,

        # Existing frontend contract: kept for backward compatibility.
        "productCount": len(
            products
        ),
        "products": legacy_products,

        # New full-quotation extraction payload.
        "quotation": {
            "company": company,
            "customer": customer,
            "quote": quote,
            "abstractItems": abstract_items,
            "products": products,
            "notes": notes,
            "terms": terms,
            "termsAndConditions": "\n\n".join(
                f"{index}. {term['text']}"
                for index, term in enumerate(
                    terms,
                    start=1,
                )
            ),
        },

        "totals": totals,
        "warnings": warnings,

        "meta": {
            "pageCount": page_count,
            "tablesFound": tables_found,
            "productTablesFound": product_tables_found,
            "pagesWithText": pages_with_text,
            "abstractCount": len(
                abstract_items
            ),
            "termCount": len(
                terms
            ),
        },
    }
