import base64
import html
import io
from pathlib import Path
import re
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import (
    TA_CENTER,
    TA_LEFT,
    TA_RIGHT,
)
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import (
    ParagraphStyle,
    getSampleStyleSheet,
)
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import (
    stringWidth,
)
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.models.quotation import (
    ProductLine,
    QuotationColumn,
    QuotationData,
)

from app.services.calculations import (
    line_base,
)


BLACK = colors.HexColor("#111111")
DARK_GRAY = colors.HexColor("#333333")
MID_GRAY = colors.HexColor("#666666")
WHITE = colors.white

PAGE_WIDTH, PAGE_HEIGHT = A4

LEFT_MARGIN = 7 * mm
RIGHT_MARGIN = 7 * mm
TOP_MARGIN = 5 * mm
BOTTOM_MARGIN = 24 * mm

CONTENT_WIDTH = (
    PAGE_WIDTH
    - LEFT_MARGIN
    - RIGHT_MARGIN
)

FRAME_HEIGHT = (
    PAGE_HEIGHT
    - TOP_MARGIN
    - BOTTOM_MARGIN
)

# ReportLab's Frame reserves 6 pt at the top and 6 pt at the
# bottom internally. Pagination must use the real drawable
# height, otherwise the last product row (or Grand Total row)
# gets pushed onto a new physical PDF page.
FRAME_INTERNAL_VERTICAL_PADDING = 12.0

USABLE_FRAME_HEIGHT = (
    FRAME_HEIGHT
    - FRAME_INTERNAL_VERTICAL_PADDING
)

DETAIL_GAP = 2 * mm
DETAIL_CONTINUATION_GAP = 2 * mm
DETAIL_TOTALS_GAP = 5 * mm
DETAIL_SAFETY = 4 * mm

PART_HEADING_GAP = 2 * mm
PART_SUBTOTAL_GAP = 2 * mm
PART_BLOCK_GAP = 4 * mm
PART_EMPTY_ROW_HEIGHT = 10 * mm

GLOBAL_GST_RATE = 18.0

TERMS_PAGE_GAP = 7 * mm
TERMS_PAGE_SAFETY = 2 * mm

# Keep product rows readable. Extra page space may enlarge a row
# slightly, but never enough to create oversized rows.
MAX_ROW_STRETCH = 0.8 * mm


def safe_text(
    value: Any,
    fallback: str = "—",
) -> str:
    if value is None:
        return fallback

    text = str(value).strip()

    if not text:
        return fallback

    return html.escape(text)


def safe_filename(
    value: str,
) -> str:
    cleaned = re.sub(
        r"[^A-Za-z0-9._-]+",
        "-",
        (value or "").strip(),
    ).strip("-")

    return (
        cleaned
        or "quotation"
    )


def _indian_number_format(
    value: float,
) -> str:
    """
    Format a numeric value using Indian digit grouping.

    Examples:
    85000       -> 85,000.00
    170000      -> 1,70,000.00
    420000      -> 4,20,000.00
    524000      -> 5,24,000.00
    4773450     -> 47,73,450.00
    """
    number = float(
        value or 0
    )

    sign = (
        "-"
        if number < 0
        else ""
    )

    absolute = abs(
        number
    )

    integer_part, decimal_part = (
        f"{absolute:.2f}"
        .split(".")
    )

    if len(
        integer_part
    ) <= 3:
        grouped = integer_part
    else:
        last_three = (
            integer_part[-3:]
        )

        remaining = (
            integer_part[:-3]
        )

        pairs: list[str] = []

        while len(
            remaining
        ) > 2:
            pairs.insert(
                0,
                remaining[-2:],
            )

            remaining = (
                remaining[:-2]
            )

        if remaining:
            pairs.insert(
                0,
                remaining,
            )

        grouped = (
            ",".join(
                pairs
                + [
                    last_three
                ]
            )
        )

    return (
        f"{sign}"
        f"{grouped}."
        f"{decimal_part}"
    )


def money(
    value: float,
) -> str:
    return (
        _indian_number_format(
            value
        )
    )


def plain_amount(
    value: float,
) -> str:
    return (
        _indian_number_format(
            value
        )
    )



def part_letter_label(
    index: int,
) -> str:
    value = max(
        0,
        int(index),
    )

    label = ""

    while True:
        label = (
            chr(
                65 +
                (value % 26)
            ) +
            label
        )

        value = (
            value // 26
        ) - 1

        if value < 0:
            break

    return (
        f"PART {label}"
    )

def _decode_data_url(
    data_url: str,
):
    if (
        not data_url
        or "," not in data_url
    ):
        return None

    try:
        encoded = data_url.split(
            ",",
            1,
        )[1]

        raw = base64.b64decode(
            encoded,
            validate=False,
        )

        return io.BytesIO(
            raw
        )

    except Exception:
        return None


# Bundled server-side logo: applies to old and new quotations alike.
COMPANY_LOGO_PATH = Path(__file__).resolve().parents[1] / "assets" / "company-logo.png"


def _logo_flowable(
    data_url: str,
):
    # The logo is application-owned, not taken from user-submitted data.
    # Preserve the argument for backward compatibility with existing callers.
    if not COMPANY_LOGO_PATH.is_file():
        raise FileNotFoundError(f"Company logo asset is missing: {COMPANY_LOGO_PATH}")

    return Image(
        str(COMPANY_LOGO_PATH),
        width=56 * mm,
        height=32 * mm,
        kind="proportional",
    )


DEFAULT_SIGNATURE_PATH = (
    Path(__file__).resolve().parents[1]
    / "assets"
    / "default-signature.png"
)


def _signature_flowable(
    data_url: str,
):
    # A custom uploaded signature overrides the bundled default.
    # Empty data is retained in older/new records to mean "use default".
    image_source = (
        _decode_data_url(data_url)
        if data_url
        else None
    )
    if image_source is None:
        if not DEFAULT_SIGNATURE_PATH.is_file():
            raise FileNotFoundError(
                f"Default signature asset is missing: {DEFAULT_SIGNATURE_PATH}"
            )
        image_source = str(DEFAULT_SIGNATURE_PATH)

    try:
        signature = Image(
            image_source,
            width=40 * mm,
            height=16 * mm,
            kind="proportional",
        )

        # Keep the digital signature aligned with the company name
        # and Authorized Signatory label on the LEFT side.
        signature.hAlign = "LEFT"

        return signature

    except Exception:
        return None


def _is_model_column(
    column: QuotationColumn,
) -> bool:
    return (
        column.kind
        in {
            "modelNumber",
            "image",
        }
    )


def _display_column_label(
    column: QuotationColumn,
) -> str:
    if _is_model_column(
        column
    ):
        return "MODEL NUMBER"

    if (
        column.kind
        == "unitPrice"
    ):
        return "PRICE"

    if (
        column.kind
        == "amount"
    ):
        return "TOTAL"

    return (
        column.label
        or "Column"
    )


def _column_weight(
    column: QuotationColumn,
) -> float:
    return {
        "serial": 0.55,
        "modelNumber": 1.45,
        "image": 1.45,
        "description": 3.2,
        "unit": 0.8,
        "quantity": 0.8,
        "unitPrice": 1.2,
        "gstRate": 0.8,
        "amount": 1.35,
        "customText": 1.6,
        "customNumber": 1.0,
        "customCurrency": 1.25,
    }.get(
        column.kind,
        1.0,
    )


def _column_widths(
    columns: list[
        QuotationColumn
    ],
) -> list[float]:
    if not columns:
        return []

    weights = [
        _column_weight(
            column
        )
        for column
        in columns
    ]

    total_weight = (
        sum(weights)
        or 1
    )

    return [
        CONTENT_WIDTH
        * weight
        / total_weight
        for weight
        in weights
    ]


def _model_number(
    product: ProductLine,
) -> str:
    direct = (
        product.modelNumber
        or ""
    ).strip()

    if direct:
        return direct

    legacy = (
        product.customValues.get(
            "modelNumber",
            "",
        )
    )

    return (
        str(legacy).strip()
        or "—"
    )


def _column_text(
    column: QuotationColumn,
    product: ProductLine,
    serial_number: int,
) -> str:
    if (
        column.kind
        == "serial"
    ):
        return str(
            serial_number
        )

    if _is_model_column(
        column
    ):
        return _model_number(
            product
        )

    if (
        column.kind
        == "description"
    ):
        return (
            product.description
            or "—"
        )

    if (
        column.kind
        == "unit"
    ):
        return (
            product.unit
            or "—"
        )

    if (
        column.kind
        == "quantity"
    ):
        return (
            f"{float(product.quantity or 0):g}"
        )

    if (
        column.kind
        == "unitPrice"
    ):
        return money(
            product.unitPrice,
        )

    if (
        column.kind
        == "gstRate"
    ):
        return (
            f"{float(product.gstRate or 0):g}%"
        )

    if (
        column.kind
        == "amount"
    ):
        return money(
            line_base(
                product,
            )
        )

    custom_value = (
        product.customValues.get(
            column.id,
            "",
        )
    )

    if (
        column.kind
        == "customCurrency"
    ):
        try:
            return money(
                float(
                    custom_value,
                )
            )

        except (
            TypeError,
            ValueError,
        ):
            return money(0)

    if (
        column.kind
        == "customNumber"
    ):
        return str(
            custom_value
            if custom_value
            not in (
                "",
                None,
            )
            else "—"
        )

    return str(
        custom_value
        if custom_value
        not in (
            "",
            None,
        )
        else "—"
    )


def _fit_text(
    text: str,
    font_name: str,
    max_font_size: float,
    min_font_size: float,
    max_width: float,
) -> float:
    font_size = (
        max_font_size
    )

    while (
        font_size
        > min_font_size
        and
        stringWidth(
            text,
            font_name,
            font_size,
        )
        > max_width
    ):
        font_size -= 0.2

    return font_size


def _footer_text(
    data: QuotationData,
) -> tuple[
    str,
    str,
]:
    # Footer editor fields are the exact source of truth.
    company_name = (
        data.company.footerLine1
        or ""
    ).strip()

    footer_details = (
        data.company.footerLine2
        or ""
    ).strip()

    return (
        company_name,
        footer_details,
    )


def _footer_lines(
    data: QuotationData,
) -> list[str]:
    """
    Build compact footer detail lines that always remain
    inside the A4 left/right margins.
    """
    custom = (
        data.company.footerLine2
        or ""
    ).strip()

    # Footer Line 2 is used exactly as edited. If it is blank,
    # the PDF footer details remain blank as well.
    parts = [
        part.strip()
        for part
        in re.split(
            r"\s*(?:\||•)\s*",
            custom,
        )
        if part.strip()
    ]

    if not parts:
        return []

    # Balance the user-entered segments across at most two lines.
    if len(parts) == 1:
        return [
            parts[0]
        ]

    best_split = 1
    best_difference = None

    for split in range(
        1,
        len(parts),
    ):
        first = " | ".join(
            parts[:split]
        )
        second = " | ".join(
            parts[split:]
        )

        difference = abs(
            len(first)
            -
            len(second)
        )

        if (
            best_difference is None
            or difference
            <
            best_difference
        ):
            best_difference = (
                difference
            )
            best_split = split

    return [
        " | ".join(
            parts[
                :best_split
            ]
        ),
        " | ".join(
            parts[
                best_split:
            ]
        ),
    ]


def _draw_page_footer(
    canvas,
    doc,
    data: QuotationData,
):
    left = LEFT_MARGIN
    right = (
        PAGE_WIDTH
        - RIGHT_MARGIN
    )
    center_x = (
        PAGE_WIDTH
        / 2
    )

    company_name = (
        data.company.footerLine1
        or ""
    ).strip()

    detail_lines = (
        _footer_lines(
            data
        )
    )

    canvas.saveState()

    # Footer rule: always within the same left/right page margins.
    canvas.setStrokeColor(
        BLACK
    )
    canvas.setLineWidth(
        0.6
    )
    canvas.line(
        left,
        20.5 * mm,
        right,
        20.5 * mm,
    )

    # Company name.
    if company_name:
        company_font_size = (
            _fit_text(
                company_name,
                "Helvetica-Bold",
                9.0,
                7.5,
                CONTENT_WIDTH,
            )
        )

        canvas.setFillColor(
            BLACK
        )
        canvas.setFont(
            "Helvetica-Bold",
            company_font_size,
        )
        canvas.drawCentredString(
            center_x,
            15.7 * mm,
            company_name,
        )

    # Company details.
    # Maximum two centered lines and each line is independently fitted
    # to the A4 content width, so nothing can leave the page.
    if detail_lines:
        available_width = (
            CONTENT_WIDTH
            - 4 * mm
        )

        if len(detail_lines) == 1:
            y_positions = [
                10.1 * mm
            ]
        else:
            y_positions = [
                11.2 * mm,
                7.8 * mm,
            ]

        for line, y_position in zip(
            detail_lines[:2],
            y_positions,
        ):
            font_size = (
                _fit_text(
                    line,
                    "Helvetica",
                    9.5,
                    7.0,
                    available_width,
                )
            )

            canvas.setFillColor(
                DARK_GRAY
            )
            canvas.setFont(
                "Helvetica",
                font_size,
            )
            canvas.drawCentredString(
                center_x,
                y_position,
                line,
            )

    # Bottom-left auto-generated note.
    canvas.setFillColor(
        MID_GRAY
    )
    canvas.setFont(
        "Helvetica",
        9.0,
    )
    canvas.drawString(
        left,
        3.4 * mm,
        "Auto Generated Quote",
    )

    # Bottom-right page number.
    canvas.setFillColor(
        DARK_GRAY
    )
    canvas.setFont(
        "Helvetica",
        7.2,
    )
    canvas.drawRightString(
        right,
        3.4 * mm,
        f"Page {doc.page}",
    )

    canvas.restoreState()


def _logo_header(
    data: QuotationData,
    small_style: ParagraphStyle,
):
    logo = _logo_flowable(
        data.company.logoDataUrl,
    )

    if logo is None:
        logo = Table(
            [
                [
                    Paragraph(
                        "<b>LOGO</b>",
                        small_style,
                    )
                ]
            ],
            colWidths=[
                56 * mm,
            ],
            rowHeights=[
                32 * mm,
            ],
        )

        logo.setStyle(
            TableStyle(
                [
                    (
                        "BOX",
                        (0, 0),
                        (-1, -1),
                        0.6,
                        MID_GRAY,
                    ),
                    (
                        "ALIGN",
                        (0, 0),
                        (-1, -1),
                        "CENTER",
                    ),
                    (
                        "VALIGN",
                        (0, 0),
                        (-1, -1),
                        "MIDDLE",
                    ),
                ]
            )
        )

    header = Table(
        [
            [
                "",
                logo,
            ]
        ],
        colWidths=[
            CONTENT_WIDTH
            - 60 * mm,
            60 * mm,
        ],
        rowHeights=[
            34 * mm,
        ],
    )

    header.setStyle(
        TableStyle(
            [
                (
                    "ALIGN",
                    (1, 0),
                    (1, 0),
                    "RIGHT",
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP",
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    0,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    0,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    2 * mm,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    0,
                ),
            ]
        )
    )

    return header


def _standard_info_style():
    return TableStyle(
        [
            (
                "BOX",
                (0, 0),
                (-1, -1),
                0.65,
                MID_GRAY,
            ),
            (
                "INNERGRID",
                (0, 0),
                (-1, -1),
                0.65,
                MID_GRAY,
            ),
            (
                "VALIGN",
                (0, 0),
                (-1, -1),
                "MIDDLE",
            ),
            (
                "LEFTPADDING",
                (0, 0),
                (-1, -1),
                6,
            ),
            (
                "RIGHTPADDING",
                (0, 0),
                (-1, -1),
                6,
            ),
            (
                "TOPPADDING",
                (0, 0),
                (-1, -1),
                6,
            ),
            (
                "BOTTOMPADDING",
                (0, 0),
                (-1, -1),
                6,
            ),
            (
                "BACKGROUND",
                (0, 0),
                (-1, -1),
                WHITE,
            ),
        ]
    )


def _build_abstract_page(
    story: list,
    data: QuotationData,
    body: ParagraphStyle,
    body_center: ParagraphStyle,
    body_right: ParagraphStyle,
    label_style: ParagraphStyle,
    heading_style: ParagraphStyle,
    small_style: ParagraphStyle,
):
    story.append(
        _logo_header(
            data,
            small_style,
        )
    )
    story.append(
        Spacer(
            1,
            2.5 * mm,
        )
    )

    client_name = (
        data.customer.name
        or data.customer.company
        or "—"
    )

    client_table = Table(
        [
            [
                Paragraph(
                    "<b>Client Name</b>",
                    label_style,
                ),
                Paragraph(
                    safe_text(
                        client_name,
                    ),
                    body,
                ),
                Paragraph(
                    "<b>Project Name</b>",
                    label_style,
                ),
                Paragraph(
                    safe_text(
                        data.quote.projectName,
                    ),
                    body,
                ),
            ],
            [
                Paragraph(
                    "<b>Client Number</b>",
                    label_style,
                ),
                Paragraph(
                    safe_text(
                        data.customer.phone,
                    ),
                    body,
                ),
                Paragraph(
                    "<b>MEP Details</b>",
                    label_style,
                ),
                Paragraph(
                    safe_text(
                        data.quote.mepDetails,
                    ),
                    body,
                ),
            ],
            [
                Paragraph(
                    "<b>Client Address</b>",
                    label_style,
                ),
                Paragraph(
                    safe_text(
                        data.customer.address,
                    ).replace(
                        "\n",
                        "<br/>",
                    ),
                    body,
                ),
                "",
                "",
            ],
        ],
        colWidths=[
            28 * mm,
            50 * mm,
            28 * mm,
            CONTENT_WIDTH
            - 106 * mm,
        ],
    )

    client_table.setStyle(
        _standard_info_style()
    )
    client_table.setStyle(
        TableStyle(
            [
                (
                    "SPAN",
                    (1, 2),
                    (3, 2),
                )
            ]
        )
    )

    story.append(
        client_table
    )
    story.append(
        Spacer(
            1,
            4 * mm,
        )
    )

    # New 3-row table between client/project and quotation tables.
    client_extra = Table(
        [
            [
                Paragraph(
                    "<b>Client GST No.</b>",
                    label_style,
                ),
                Paragraph(
                    safe_text(
                        data.customer.gstNo,
                    ),
                    body,
                ),
            ],
            [
                Paragraph(
                    "<b>Client Email</b>",
                    label_style,
                ),
                Paragraph(
                    safe_text(
                        data.customer.email,
                    ),
                    body,
                ),
            ],
            [
                Paragraph(
                    "<b>Site Location</b>",
                    label_style,
                ),
                Paragraph(
                    safe_text(
                        data.quote.siteLocation,
                    ),
                    body,
                ),
            ],
        ],
        colWidths=[
            30 * mm,
            CONTENT_WIDTH
            - 30 * mm,
        ],
    )

    client_extra.setStyle(
        _standard_info_style()
    )

    story.append(
        client_extra
    )
    story.append(
        Spacer(
            1,
            4 * mm,
        )
    )

    quote_table = Table(
        [
            [
                Paragraph(
                    "<b>Qt. No</b>",
                    label_style,
                ),
                Paragraph(
                    safe_text(
                        data.quote.quoteNumber,
                    ),
                    body,
                ),
            ],
            [
                Paragraph(
                    "<b>Qt. Date</b>",
                    label_style,
                ),
                Paragraph(
                    safe_text(
                        data.quote.quoteDate,
                    ),
                    body,
                ),
            ],
            [
                Paragraph(
                    "<b>Qt. Details</b>",
                    label_style,
                ),
                Paragraph(
                    safe_text(
                        data.quote.quoteDetails,
                    ).replace(
                        "\n",
                        "<br/>",
                    ),
                    body,
                ),
            ],
        ],
        colWidths=[
            30 * mm,
            CONTENT_WIDTH
            - 30 * mm,
        ],
    )

    quote_table.setStyle(
        _standard_info_style()
    )

    story.append(
        quote_table
    )
    story.append(
        Spacer(
            1,
            5 * mm,
        )
    )

    story.append(
        Paragraph(
            "ABSTRACT",
            heading_style,
        )
    )
    story.append(
        Spacer(
            1,
            2.5 * mm,
        )
    )

    abstract_rows = [
        [
            Paragraph(
                "<b>SL.NO</b>",
                body_center,
            ),
            Paragraph(
                "<b>PARTS</b>",
                body_center,
            ),
            Paragraph(
                "<b>DESCRIPTION</b>",
                body_center,
            ),
            Paragraph(
                "<b>PRICE</b>",
                body_center,
            ),
        ]
    ]

    for (
        index,
        item,
    ) in enumerate(
        data.abstractItems,
        start=1,
    ):
        abstract_rows.append(
            [
                Paragraph(
                    str(index),
                    body_center,
                ),
                Paragraph(
                    (
                        "<b>"
                        f"{part_letter_label(index - 1)}"
                        "</b>"
                    ),
                    body_center,
                ),
                Paragraph(
                    safe_text(
                        item.description,
                    ).replace(
                        "\n",
                        "<br/>",
                    ),
                    body,
                ),
                Paragraph(
                    plain_amount(
                        item.price,
                    ),
                    body_right,
                ),
            ]
        )

    if not data.abstractItems:
        abstract_rows.append(
            [
                Paragraph(
                    "1",
                    body_center,
                ),
                Paragraph(
                    "<b>PART A</b>",
                    body_center,
                ),
                Paragraph(
                    "—",
                    body,
                ),
                Paragraph(
                    "0.00",
                    body_right,
                ),
            ]
        )

    abstract_total = sum(
        float(
            item.price
            or 0
        )
        for item
        in data.abstractItems
    )

    abstract_gst = (
        abstract_total
        * GLOBAL_GST_RATE
        / 100
    )
    abstract_total_including_gst = (
        abstract_total
        + abstract_gst
    )

    abstract_rows.extend(
        [
            [
                Paragraph(
                    "<b>Subtotal</b>",
                    body_right,
                ),
                "",
                "",
                Paragraph(
                    (
                        "<b>"
                        f"{plain_amount(abstract_total)}"
                        "</b>"
                    ),
                    body_right,
                ),
            ],
            [
                Paragraph(
                    f"GST {GLOBAL_GST_RATE:g}%",
                    body_right,
                ),
                "",
                "",
                Paragraph(
                    plain_amount(abstract_gst),
                    body_right,
                ),
            ],
            [
                Paragraph(
                    "<b>Grand Total</b>",
                    body_right,
                ),
                "",
                "",
                Paragraph(
                    (
                        "<b>"
                        f"{plain_amount(abstract_total_including_gst)}"
                        "</b>"
                    ),
                    body_right,
                ),
            ],
        ]
    )

    abstract_table = Table(
        abstract_rows,
        colWidths=[
            14 * mm,
            22 * mm,
            CONTENT_WIDTH
            - 71 * mm,
            35 * mm,
        ],
        repeatRows=1,
    )

    abstract_table.setStyle(
        TableStyle(
            [
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    0.7,
                    MID_GRAY,
                ),
                (
                    "INNERGRID",
                    (0, 0),
                    (-1, -4),
                    0.6,
                    MID_GRAY,
                ),
                # Strong separator between the item rows and totals.
                (
                    "LINEABOVE",
                    (0, -3),
                    (-1, -3),
                    0.8,
                    BLACK,
                ),
                # Separate Excl. GST from the GST row.
                (
                    "LINEBELOW",
                    (0, -3),
                    (-1, -3),
                    0.65,
                    MID_GRAY,
                ),
                # Separate the GST row from the final Incl. GST total.
                (
                    "LINEBELOW",
                    (0, -2),
                    (-1, -2),
                    0.8,
                    BLACK,
                ),
                # Keep a visible divider between the total label and amount.
                (
                    "LINEBEFORE",
                    (3, -3),
                    (3, -1),
                    0.65,
                    MID_GRAY,
                ),
                (
                    "SPAN",
                    (0, -3),
                    (2, -3),
                ),
                (
                    "SPAN",
                    (0, -2),
                    (2, -2),
                ),
                (
                    "SPAN",
                    (0, -1),
                    (2, -1),
                ),
                (
                    "ALIGN",
                    (0, -3),
                    (2, -1),
                    "RIGHT",
                ),
                (
                    "ALIGN",
                    (0, 0),
                    (0, -1),
                    "CENTER",
                ),
                (
                    "ALIGN",
                    (3, 1),
                    (3, -1),
                    "RIGHT",
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, -1),
                    WHITE,
                ),
            ]
        )
    )

    story.append(
        abstract_table
    )
    story.append(
        Spacer(
            1,
            1.5 * mm,
        )
    )

    if (
        data.notes
        and data.notes.strip()
    ):
        story.append(
            Spacer(
                1,
                3 * mm,
            )
        )

        story.append(
            Paragraph(
                (
                    "<b>Note:</b> "
                    +
                    safe_text(
                        data.notes,
                    ).replace(
                        "\n",
                        "<br/>",
                    )
                ),
                small_style,
            )
        )


def _detail_header(
    data: QuotationData,
    body: ParagraphStyle,
    small_style: ParagraphStyle,
):
    logo = _logo_flowable(
        data.company.logoDataUrl,
    )

    if logo is None:
        logo = Table(
            [
                [
                    Paragraph(
                        "<b>LOGO</b>",
                        small_style,
                    )
                ]
            ],
            colWidths=[
                56 * mm
            ],
            rowHeights=[
                32 * mm
            ],
        )

        logo.setStyle(
            TableStyle(
                [
                    (
                        "BOX",
                        (0, 0),
                        (-1, -1),
                        0.6,
                        MID_GRAY,
                    ),
                    (
                        "ALIGN",
                        (0, 0),
                        (-1, -1),
                        "CENTER",
                    ),
                    (
                        "VALIGN",
                        (0, 0),
                        (-1, -1),
                        "MIDDLE",
                    ),
                ]
            )
        )

    left_content = Paragraph(
        (
            "<b>PRODUCTS BOQ</b>"
            "<br/>"
            "<font size='7'>"
            "Quotation No: "
            f"<b>{safe_text(data.quote.quoteNumber)}</b>"
            "</font>"
        ),
        ParagraphStyle(
            "product_detail_heading",
            parent=body,
            fontName=
                "Helvetica-Bold",
            fontSize=18,
            leading=21,
            textColor=BLACK,
        ),
    )

    # Product page header:
    # 1) logo at the top-right
    # 2) Product Details heading below the logo
    # 3) quotation number below the heading
    header = Table(
        [
            [
                "",
                logo,
            ],
            [
                left_content,
                "",
            ],
        ],
        colWidths=[
            CONTENT_WIDTH
            - 60 * mm,
            60 * mm,
        ],
    )

    header.setStyle(
        TableStyle(
            [
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP",
                ),
                (
                    "ALIGN",
                    (1, 0),
                    (1, 0),
                    "RIGHT",
                ),
                (
                    "LINEBELOW",
                    (0, 1),
                    (-1, 1),
                    0.7,
                    BLACK,
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    0,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    0,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, 0),
                    1.5 * mm,
                ),
                (
                    "TOPPADDING",
                    (0, 1),
                    (-1, 1),
                    0,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, 0),
                    0.5 * mm,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 1),
                    (-1, 1),
                    6,
                ),
            ]
        )
    )

    return header


def _product_cell(
    column: QuotationColumn,
    product: ProductLine,
    serial_number: int,
    body: ParagraphStyle,
    body_center: ParagraphStyle,
):
    value = _column_text(
        column,
        product,
        serial_number,
    )

    paragraph_style = (
        body
        if
        column.kind
        == "description"
        else body_center
    )

    return Paragraph(
        safe_text(
            value,
        ).replace(
            "\n",
            "<br/>",
        ),
        paragraph_style,
    )


def _product_table_style(
    columns: list[
        QuotationColumn
    ],
):
    style_commands = [
        (
            "BOX",
            (0, 0),
            (-1, -1),
            0.65,
            MID_GRAY,
        ),
        (
            "INNERGRID",
            (0, 0),
            (-1, -1),
            0.55,
            MID_GRAY,
        ),
        (
            "BACKGROUND",
            (0, 0),
            (-1, -1),
            WHITE,
        ),
        (
            "VALIGN",
            (0, 0),
            (-1, -1),
            "MIDDLE",
        ),
        (
            "ALIGN",
            (0, 0),
            (-1, 0),
            "CENTER",
        ),
        (
            "LEFTPADDING",
            (0, 0),
            (-1, -1),
            4,
        ),
        (
            "RIGHTPADDING",
            (0, 0),
            (-1, -1),
            4,
        ),
        (
            "TOPPADDING",
            (0, 0),
            (-1, 0),
            6,
        ),
        (
            "BOTTOMPADDING",
            (0, 0),
            (-1, 0),
            6,
        ),
        (
            "TOPPADDING",
            (0, 1),
            (-1, -1),
            7,
        ),
        (
            "BOTTOMPADDING",
            (0, 1),
            (-1, -1),
            7,
        ),
    ]

    for (
        index,
        column,
    ) in enumerate(
        columns,
    ):
        style_commands.append(
            (
                "ALIGN",
                (index, 1),
                (index, -1),
                (
                    "LEFT"
                    if
                    column.kind
                    == "description"
                    else
                    "CENTER"
                ),
            )
        )

    return TableStyle(
        style_commands
    )


def _product_rows(
    products: list[
        ProductLine
    ],
    columns: list[
        QuotationColumn
    ],
    body: ParagraphStyle,
    body_center: ParagraphStyle,
):
    rows = []

    for (
        index,
        product,
    ) in enumerate(
        products,
        start=1,
    ):
        rows.append(
            [
                _product_cell(
                    column,
                    product,
                    index,
                    body,
                    body_center,
                )
                for column
                in columns
            ]
        )

    return rows


def _header_row(
    columns: list[
        QuotationColumn
    ],
    body_center: ParagraphStyle,
):
    return [
        Paragraph(
            (
                "<b>"
                f"{safe_text(_display_column_label(column), 'Column')}"
                "</b>"
            ),
            body_center,
        )
        for column
        in columns
    ]


def _measure_table_height(
    table: Table,
) -> float:
    _, height = table.wrap(
        CONTENT_WIDTH,
        USABLE_FRAME_HEIGHT,
    )

    return float(
        height
    )


def _measure_header_row_height(
    columns: list[
        QuotationColumn
    ],
    body_center:
        ParagraphStyle,
) -> float:
    table = Table(
        [
            _header_row(
                columns,
                body_center,
            )
        ],
        colWidths=
            _column_widths(
                columns
            ),
    )

    table.setStyle(
        _product_table_style(
            columns
        )
    )

    return (
        _measure_table_height(
            table
        )
    )


def _measure_product_row_heights(
    products: list[
        ProductLine
    ],
    columns: list[
        QuotationColumn
    ],
    body: ParagraphStyle,
    body_center:
        ParagraphStyle,
) -> tuple[
    list[list[Any]],
    list[float],
]:
    widths = _column_widths(
        columns
    )

    rows = _product_rows(
        products,
        columns,
        body,
        body_center,
    )

    heights = []

    for row in rows:
        table = Table(
            [row],
            colWidths=widths,
        )

        table.setStyle(
            _product_table_style(
                columns
            )
        )

        heights.append(
            max(
                23.0,
                _measure_table_height(
                    table
                ),
            )
        )

    return (
        rows,
        heights,
    )


def _calculate_detail_totals(
    data: QuotationData,
):
    subtotal = sum(
        line_base(
            product,
        )
        for product
        in data.products
    )

    gst_amount = (
        subtotal
        *
        GLOBAL_GST_RATE
        /
        100
    )

    grand_total = (
        subtotal
        +
        gst_amount
    )

    return (
        subtotal,
        gst_amount,
        grand_total,
    )


def _build_detail_totals(
    data: QuotationData,
    body_right:
        ParagraphStyle,
):
    (
        subtotal,
        gst_amount,
        grand_total,
    ) = _calculate_detail_totals(
        data,
    )

    rows = [
        [
            Paragraph(
                "<b>Subtotal</b>",
                body_right,
            ),
            Paragraph(
                money(
                    subtotal,
                ),
                body_right,
            ),
        ],
        [
            Paragraph(
                (
                    "<b>"
                    f"GST {GLOBAL_GST_RATE:g}%"
                    "</b>"
                ),
                body_right,
            ),
            Paragraph(
                money(
                    gst_amount,
                ),
                body_right,
            ),
        ],
        [
            Paragraph(
                "<b>Grand Total</b>",
                body_right,
            ),
            Paragraph(
                (
                    "<b>"
                    f"{money(grand_total)}"
                    "</b>"
                ),
                body_right,
            ),
        ],
    ]

    totals_table = Table(
        rows,
        colWidths=[
            CONTENT_WIDTH
            - 43 * mm,
            43 * mm,
        ],
        hAlign="LEFT",
    )

    totals_table.setStyle(
        TableStyle(
            [
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    0.65,
                    MID_GRAY,
                ),
                (
                    "INNERGRID",
                    (0, 0),
                    (-1, -1),
                    0.55,
                    MID_GRAY,
                ),
                (
                    "LINEABOVE",
                    (0, -1),
                    (-1, -1),
                    0.9,
                    BLACK,
                ),
                (
                    "ALIGN",
                    (0, 0),
                    (-1, -1),
                    "RIGHT",
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, -1),
                    WHITE,
                ),
            ]
        )
    )

    return totals_table


def _sum_heights(
    indices: list[int],
    heights: list[float],
) -> float:
    return sum(
        heights[index]
        for index
        in indices
    )


def _partition_rows_for_best_fill(
    heights: list[float],
    normal_budget: float,
    final_budget: float,
) -> list[list[int]]:
    count = len(
        heights
    )

    if count == 0:
        return [[]]

    prefix = [
        0.0
        for _
        in range(
            count + 1
        )
    ]

    for index in range(
        count
    ):
        prefix[index + 1] = (
            prefix[index]
            +
            heights[index]
        )

    def range_height(
        start: int,
        end: int,
    ) -> float:
        return (
            prefix[end]
            -
            prefix[start]
        )

    # Use the minimum feasible number of Product Details pages.
    # For that page count, choose the sequential split which
    # minimises the largest per-row stretch. This gives the
    # best compromise between:
    # - no wasted page space,
    # - no unnecessary extra page,
    # - no tiny 2–3-row middle page,
    # - and no excessively tall rows if a better split exists.

    for page_count in range(
        1,
        count + 1,
    ):
        memo: dict[
            tuple[int, int],
            tuple[
                float,
                float,
                list[
                    list[int]
                ],
            ]
            | None,
        ] = {}

        def solve(
            start: int,
            page_index: int,
        ):
            key = (
                start,
                page_index,
            )

            if key in memo:
                return memo[key]

            pages_left = (
                page_count
                -
                page_index
            )

            rows_left = (
                count
                -
                start
            )

            if (
                rows_left
                <
                pages_left
            ):
                memo[key] = None
                return None

            budget = (
                final_budget
                if
                page_index
                ==
                page_count - 1
                else
                normal_budget
            )

            if (
                page_index
                ==
                page_count - 1
            ):
                natural = (
                    range_height(
                        start,
                        count,
                    )
                )

                if natural > budget:
                    memo[key] = None
                    return None

                row_count = (
                    count
                    -
                    start
                )

                extra = (
                    (
                        budget
                        -
                        natural
                    )
                    /
                    row_count
                    if row_count
                    else 0.0
                )

                result = (
                    extra,
                    extra,
                    [
                        list(
                            range(
                                start,
                                count,
                            )
                        )
                    ],
                )

                memo[key] = result
                return result

            best = None

            max_end = (
                count
                -
                (
                    pages_left
                    -
                    1
                )
            )

            for end in range(
                start + 1,
                max_end + 1,
            ):
                natural = (
                    range_height(
                        start,
                        end,
                    )
                )

                if natural > budget:
                    break

                next_result = (
                    solve(
                        end,
                        page_index + 1,
                    )
                )

                if next_result is None:
                    continue

                (
                    next_max_extra,
                    next_total_extra,
                    next_pages,
                ) = next_result

                row_count = (
                    end
                    -
                    start
                )

                extra = (
                    (
                        budget
                        -
                        natural
                    )
                    /
                    row_count
                )

                candidate = (
                    max(
                        extra,
                        next_max_extra,
                    ),
                    (
                        extra
                        +
                        next_total_extra
                    ),
                    [
                        list(
                            range(
                                start,
                                end,
                            )
                        ),
                        *next_pages,
                    ],
                )

                if best is None:
                    best = candidate
                    continue

                (
                    best_max_extra,
                    best_total_extra,
                    _,
                ) = best

                is_better = (
                    candidate[0]
                    <
                    best_max_extra
                    -
                    0.01
                    or
                    (
                        abs(
                            candidate[0]
                            -
                            best_max_extra
                        )
                        <= 0.01
                        and
                        candidate[1]
                        <
                        best_total_extra
                    )
                )

                if is_better:
                    best = candidate

            memo[key] = best
            return best

        result = solve(
            0,
            0,
        )

        if result is not None:
            return result[2]

    return [
        list(
            range(
                count
            )
        )
    ]

def _stretch_heights(
    indices: list[int],
    natural_heights:
        list[float],
    budget: float,
) -> list[float]:
    if not indices:
        return []

    natural_total = (
        _sum_heights(
            indices,
            natural_heights,
        )
    )

    extra_each = (
        max(
            0.0,
            budget
            -
            natural_total,
        )
        /
        len(indices)
    )

    return [
        natural_heights[index]
        +
        extra_each
        for index
        in indices
    ]


def _detail_continuation(
    page_index: int,
    page_count: int,
    small_style:
        ParagraphStyle,
):
    if page_count <= 1:
        return None

    return Paragraph(
        (
            "Product Details — "
            f"{page_index + 1}"
            " of "
            f"{page_count}"
        ),
        ParagraphStyle(
            f"product_continuation_{page_index}",
            parent=
                small_style,
            alignment=
                TA_RIGHT,
            fontSize=6.5,
            leading=8,
        ),
    )


def _resolve_product_part_id(
    product: ProductLine,
    part_ids: list[str],
) -> str:
    requested = (
        product.abstractItemId
        or ""
    ).strip()

    if (
        requested
        and
        requested in part_ids
    ):
        return requested

    return (
        part_ids[0]
        if part_ids
        else "__default_part__"
    )


def _part_heading(
    part_number: int,
    description: str,
    continued: bool,
    body: ParagraphStyle,
):
    label = (
        f"PART {part_number}"
        +
        (
            " - CONTINUED"
            if continued
            else ""
        )
    )

    table = Table(
        [
            [
                Paragraph(
                    (
                        "<b>"
                        f"{safe_text(label)}"
                        "</b>"
                    ),
                    ParagraphStyle(
                        f"part_label_{part_number}_{continued}",
                        parent=body,
                        fontName="Helvetica-Bold",
                        fontSize=9,
                        leading=11,
                        textColor=BLACK,
                    ),
                ),
                Paragraph(
                    (
                        "<b>"
                        f"{safe_text(description, f'Abstract Row {part_number}')}"
                        "</b>"
                    ),
                    ParagraphStyle(
                        f"part_description_{part_number}_{continued}",
                        parent=body,
                        fontName="Helvetica-Bold",
                        fontSize=9,
                        leading=11,
                        textColor=BLACK,
                    ),
                ),
            ]
        ],
        colWidths=[
            32 * mm,
            CONTENT_WIDTH
            - 32 * mm,
        ],
        hAlign="LEFT",
    )

    table.setStyle(
        TableStyle(
            [
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    0.65,
                    MID_GRAY,
                ),
                (
                    "INNERGRID",
                    (0, 0),
                    (-1, -1),
                    0.45,
                    colors.HexColor(
                        "#B7B7B7"
                    ),
                ),
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, -1),
                    colors.HexColor(
                        "#F4F4F4"
                    ),
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    7,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    7,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    7,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    7,
                ),
            ]
        )
    )

    return table


def _part_subtotal_table(
    part_number: int,
    subtotal: float,
    body_right: ParagraphStyle,
):
    table = Table(
        [
            [
                Paragraph(
                    (
                        "<b>"
                        f"Part {part_number} Subtotal"
                        "</b>"
                    ),
                    body_right,
                ),
                Paragraph(
                    (
                        "<b>"
                        f"{money(subtotal)}"
                        "</b>"
                    ),
                    body_right,
                ),
            ]
        ],
        colWidths=[
            CONTENT_WIDTH
            - 43 * mm,
            43 * mm,
        ],
        hAlign="LEFT",
    )

    table.setStyle(
        TableStyle(
            [
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    0.65,
                    MID_GRAY,
                ),
                (
                    "INNERGRID",
                    (0, 0),
                    (-1, -1),
                    0.55,
                    MID_GRAY,
                ),
                (
                    "ALIGN",
                    (0, 0),
                    (-1, -1),
                    "RIGHT",
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, -1),
                    WHITE,
                ),
            ]
        )
    )

    return table


def _grouped_detail_pages(
    data: QuotationData,
    natural_heights: list[float],
    header_height: float,
    page_budget: float,
    totals_height: float,
    body: ParagraphStyle,
    body_right: ParagraphStyle,
):
    if data.abstractItems:
        parts = [
            (
                item.id,
                item.description,
            )
            for item
            in data.abstractItems
        ]
    else:
        parts = [
            (
                "__default_part__",
                "Products",
            )
        ]

    part_ids = [
        part_id
        for (
            part_id,
            _,
        )
        in parts
    ]

    pages = [
        {
            "segments": [],
            "used": 0.0,
        }
    ]

    def current_page():
        return pages[-1]

    def start_new_page():
        pages.append(
            {
                "segments": [],
                "used": 0.0,
            }
        )

    for (
        part_index,
        (
            part_id,
            part_description,
        ),
    ) in enumerate(parts):
        product_indices = [
            product_index
            for (
                product_index,
                product,
            )
            in enumerate(
                data.products
            )
            if (
                _resolve_product_part_id(
                    product,
                    part_ids,
                )
                == part_id
            )
        ]

        is_final_part = (
            part_index
            ==
            len(parts) - 1
        )

        subtotal = sum(
            line_base(
                data.products[
                    product_index
                ]
            )
            for product_index
            in product_indices
        )

        subtotal_table = (
            _part_subtotal_table(
                part_index + 1,
                subtotal,
                body_right,
            )
        )

        subtotal_height = (
            _measure_table_height(
                subtotal_table
            )
        )

        if not product_indices:
            heading = _part_heading(
                part_index + 1,
                part_description,
                False,
                body,
            )

            heading_height = (
                _measure_table_height(
                    heading
                )
            )

            required = (
                heading_height
                + PART_HEADING_GAP
                + header_height
                + PART_EMPTY_ROW_HEIGHT
                + PART_SUBTOTAL_GAP
                + subtotal_height
                + PART_BLOCK_GAP
                + (
                    DETAIL_TOTALS_GAP
                    + totals_height
                    if is_final_part
                    else 0
                )
            )

            if (
                current_page()[
                    "used"
                ]
                > 0
                and
                current_page()[
                    "used"
                ]
                + required
                > page_budget
            ):
                start_new_page()

            current_page()[
                "segments"
            ].append(
                {
                    "part_id":
                        part_id,
                    "part_index":
                        part_index,
                    "part_description":
                        part_description,
                    "product_indices":
                        [],
                    "serial_start":
                        0,
                    "continued":
                        False,
                    "show_subtotal":
                        True,
                    "row_heights":
                        [],
                    "subtotal":
                        subtotal,
                }
            )

            current_page()[
                "used"
            ] += required

            continue

        cursor = 0
        continued = False

        while (
            cursor
            <
            len(
                product_indices
            )
        ):
            heading = _part_heading(
                part_index + 1,
                part_description,
                continued,
                body,
            )

            heading_height = (
                _measure_table_height(
                    heading
                )
            )

            base = (
                heading_height
                + PART_HEADING_GAP
                + header_height
            )

            available = (
                page_budget
                -
                current_page()[
                    "used"
                ]
            )

            next_product_index = (
                product_indices[
                    cursor
                ]
            )

            next_row_height = (
                natural_heights[
                    next_product_index
                ]
                if (
                    next_product_index
                    <
                    len(
                        natural_heights
                    )
                )
                else 23.0
            )

            if (
                current_page()[
                    "used"
                ]
                > 0
                and
                available
                <
                base
                + next_row_height
            ):
                start_new_page()
                continue

            selected = []
            selected_heights = []
            rows_height = 0.0
            serial_start = cursor

            while (
                cursor
                <
                len(
                    product_indices
                )
            ):
                product_index = (
                    product_indices[
                        cursor
                    ]
                )

                row_height = (
                    natural_heights[
                        product_index
                    ]
                    if (
                        product_index
                        <
                        len(
                            natural_heights
                        )
                    )
                    else 23.0
                )

                is_last_row = (
                    cursor
                    ==
                    len(
                        product_indices
                    )
                    - 1
                )

                reserve = (
                    (
                        PART_SUBTOTAL_GAP
                        + subtotal_height
                        + PART_BLOCK_GAP
                    )
                    if is_last_row
                    else 0.0
                )

                if (
                    is_last_row
                    and
                    is_final_part
                ):
                    reserve += (
                        DETAIL_TOTALS_GAP
                        + totals_height
                    )

                fits = (
                    base
                    + rows_height
                    + row_height
                    + reserve
                    <= available
                )

                force_first = (
                    not selected
                    and
                    current_page()[
                        "used"
                    ]
                    == 0
                )

                if (
                    fits
                    or force_first
                ):
                    selected.append(
                        product_index
                    )

                    selected_heights.append(
                        row_height
                    )

                    rows_height += (
                        row_height
                    )

                    cursor += 1
                    continue

                break

            if not selected:
                start_new_page()
                continue

            completed = (
                cursor
                ==
                len(
                    product_indices
                )
            )

            current_page()[
                "segments"
            ].append(
                {
                    "part_id":
                        part_id,
                    "part_index":
                        part_index,
                    "part_description":
                        part_description,
                    "product_indices":
                        selected,
                    "serial_start":
                        serial_start,
                    "continued":
                        continued,
                    "show_subtotal":
                        completed,
                    "row_heights":
                        selected_heights,
                    "subtotal":
                        subtotal,
                }
            )

            current_page()[
                "used"
            ] += (
                base
                + rows_height
                + (
                    PART_SUBTOTAL_GAP
                    + subtotal_height
                    + PART_BLOCK_GAP
                    if completed
                    else 0.0
                )
                + (
                    DETAIL_TOTALS_GAP
                    + totals_height
                    if (
                        completed
                        and
                        is_final_part
                    )
                    else 0.0
                )
            )

            if not completed:
                start_new_page()
                continued = True

    return [
        page
        for page
        in pages
        if page[
            "segments"
        ]
    ]


def _build_detail_pages(
    story: list,
    data: QuotationData,
    body: ParagraphStyle,
    body_center:
        ParagraphStyle,
    body_right:
        ParagraphStyle,
    small_style:
        ParagraphStyle,
):
    visible_columns = [
        column
        for column
        in data.columns
        if (
            column.visible
            and
            column.kind
            != "gstRate"
        )
    ]

    if not visible_columns:
        return

    # Legacy image column becomes Model Number automatically.
    visible_columns = [
        (
            QuotationColumn(
                id=
                    column.id,
                label=
                    "Model Number",
                kind=
                    "modelNumber",
                visible=True,
            )
            if
            column.kind
            == "image"
            else
            column
        )
        for column
        in visible_columns
    ]

    _, natural_heights = (
        _measure_product_row_heights(
            data.products,
            visible_columns,
            body,
            body_center,
        )
    )

    header_height = (
        _measure_header_row_height(
            visible_columns,
            body_center,
        )
    )

    detail_header_height = (
        _measure_table_height(
            _detail_header(
                data,
                body,
                small_style,
            )
        )
    )

    continuation_sample = (
        _detail_continuation(
            0,
            2,
            small_style,
        )
    )

    continuation_height = (
        0.0
        if continuation_sample
        is None
        else
        float(
            continuation_sample.wrap(
                CONTENT_WIDTH,
                USABLE_FRAME_HEIGHT,
            )[1]
        )
    )

    totals_table = (
        _build_detail_totals(
            data,
            body_right,
        )
    )

    totals_height = (
        _measure_table_height(
            totals_table
        )
    )

    # Reserve the continuation-line height on every detail page.
    # This makes the grouped layout stable before the final page
    # count is known and prevents any Part subtotal from spilling.
    page_budget = (
        USABLE_FRAME_HEIGHT
        -
        detail_header_height
        -
        DETAIL_GAP
        -
        continuation_height
        -
        DETAIL_CONTINUATION_GAP
        -
        DETAIL_SAFETY
    )

    pages = (
        _grouped_detail_pages(
            data,
            natural_heights,
            header_height,
            page_budget,
            totals_height,
            body,
            body_right,
        )
    )

    if not pages:
        return

    page_count = len(
        pages
    )

    widths = _column_widths(
        visible_columns
    )

    if data.abstractItems:
        part_ids = [
            item.id
            for item
            in data.abstractItems
        ]
    else:
        part_ids = [
            "__default_part__"
        ]

    for (
        page_index,
        page,
    ) in enumerate(
        pages
    ):
        if page_index > 0:
            story.append(
                PageBreak()
            )

        story.append(
            _detail_header(
                data,
                body,
                small_style,
            )
        )

        story.append(
            Spacer(
                1,
                DETAIL_GAP,
            )
        )

        continuation = (
            _detail_continuation(
                page_index,
                page_count,
                small_style,
            )
        )

        if continuation:
            story.append(
                continuation
            )

            story.append(
                Spacer(
                    1,
                    DETAIL_CONTINUATION_GAP,
                )
            )

        for (
            segment_index,
            segment,
        ) in enumerate(
            page[
                "segments"
            ]
        ):
            part_number = (
                segment[
                    "part_index"
                ]
                + 1
            )

            continued_label = (
                " - CONTINUED"
                if segment[
                    "continued"
                ]
                else ""
            )

            part_label = (
                f"{part_letter_label(part_number - 1)}"
                f"{continued_label}"
            )

            part_description = (
                segment[
                    "part_description"
                ]
                or
                f"Abstract Row {part_number}"
            )

            column_count = len(
                visible_columns
            )

            if column_count > 2:
                part_row = [
                    Paragraph(
                        (
                            "<b>"
                            f"{safe_text(part_label)}"
                            "</b>"
                        ),
                        ParagraphStyle(
                            f"part_label_inline_{page_index}_{segment_index}",
                            parent=body_center,
                            fontName="Helvetica-Bold",
                            fontSize=8.5,
                            leading=10.5,
                            textColor=BLACK,
                        ),
                    ),
                    "",
                    Paragraph(
                        (
                            "<b>"
                            f"{safe_text(part_description)}"
                            "</b>"
                        ),
                        ParagraphStyle(
                            f"part_description_inline_{page_index}_{segment_index}",
                            parent=body,
                            fontName="Helvetica-Bold",
                            fontSize=8.5,
                            leading=10.5,
                            textColor=BLACK,
                        ),
                    ),
                ]

                part_row.extend(
                    [
                        ""
                        for _
                        in range(
                            column_count - 3
                        )
                    ]
                )
            elif column_count > 1:
                part_row = [
                    Paragraph(
                        (
                            "<b>"
                            f"{safe_text(part_label)}"
                            "</b>"
                        ),
                        ParagraphStyle(
                            f"part_label_inline_{page_index}_{segment_index}",
                            parent=body_center,
                            fontName="Helvetica-Bold",
                            fontSize=8.5,
                            leading=10.5,
                            textColor=BLACK,
                        ),
                    ),
                    Paragraph(
                        (
                            "<b>"
                            f"{safe_text(part_description)}"
                            "</b>"
                        ),
                        ParagraphStyle(
                            f"part_description_inline_{page_index}_{segment_index}",
                            parent=body,
                            fontName="Helvetica-Bold",
                            fontSize=8.5,
                            leading=10.5,
                            textColor=BLACK,
                        ),
                    ),
                ]
            else:
                part_row = [
                    Paragraph(
                        (
                            "<b>"
                            f"{safe_text(part_label)}"
                            "</b> - "
                            f"{safe_text(part_description)}"
                        ),
                        ParagraphStyle(
                            f"part_single_inline_{page_index}_{segment_index}",
                            parent=body,
                            fontName="Helvetica-Bold",
                            fontSize=8.5,
                            leading=10.5,
                            textColor=BLACK,
                        ),
                    )
                ]

            table_rows = [
                part_row,
                _header_row(
                    visible_columns,
                    body_center,
                ),
            ]

            row_heights = [
                None,
                header_height,
            ]

            if segment[
                "product_indices"
            ]:
                for (
                    local_index,
                    product_index,
                ) in enumerate(
                    segment[
                        "product_indices"
                    ]
                ):
                    product = (
                        data.products[
                            product_index
                        ]
                    )

                    serial_number = (
                        segment[
                            "serial_start"
                        ]
                        + local_index
                        + 1
                    )

                    table_rows.append(
                        [
                            _product_cell(
                                column,
                                product,
                                serial_number,
                                body,
                                body_center,
                            )
                            for column
                            in visible_columns
                        ]
                    )

                row_heights.extend(
                    segment[
                        "row_heights"
                    ]
                )
            else:
                empty_row = [
                    Paragraph(
                        "No products added for this part.",
                        body_center,
                    )
                ]

                empty_row.extend(
                    [
                        ""
                        for _
                        in visible_columns[
                            1:
                        ]
                    ]
                )

                table_rows.append(
                    empty_row
                )

                row_heights.append(
                    PART_EMPTY_ROW_HEIGHT
                )

            subtotal_row_index = None

            if segment[
                "show_subtotal"
            ]:
                subtotal_row_index = len(
                    table_rows
                )

                if column_count > 1:
                    subtotal_row = [
                        Paragraph(
                            (
                                "<b>"
                                f"{part_letter_label(part_number - 1)} Subtotal"
                                "</b>"
                            ),
                            body_right,
                        )
                    ]

                    subtotal_row.extend(
                        [
                            ""
                            for _
                            in range(
                                column_count - 2
                            )
                        ]
                    )

                    subtotal_row.append(
                        Paragraph(
                            (
                                "<b>"
                                f"{money(segment['subtotal'])}"
                                "</b>"
                            ),
                            body_right,
                        )
                    )
                else:
                    subtotal_row = [
                        Paragraph(
                            (
                                "<b>"
                                f"{part_letter_label(part_number - 1)} Subtotal: "
                                f"{money(segment['subtotal'])}"
                                "</b>"
                            ),
                            body_right,
                        )
                    ]

                table_rows.append(
                    subtotal_row
                )
                row_heights.append(
                    None
                )

            table = Table(
                table_rows,
                colWidths=widths,
                rowHeights=
                    row_heights,
                repeatRows=2,
                hAlign="LEFT",
                splitByRow=1,
            )

            style_commands = [
                (
                    "BOX",
                    (0, 0),
                    (-1, -1),
                    0.65,
                    MID_GRAY,
                ),
                (
                    "INNERGRID",
                    (0, 0),
                    (-1, -1),
                    0.55,
                    MID_GRAY,
                ),
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, -1),
                    WHITE,
                ),
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.HexColor(
                        "#F4F4F4"
                    ),
                ),
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "MIDDLE",
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    4,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    4,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, 0),
                    5,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, 0),
                    5,
                ),
                (
                    "ALIGN",
                    (0, 1),
                    (-1, 1),
                    "CENTER",
                ),
                (
                    "TOPPADDING",
                    (0, 1),
                    (-1, 1),
                    6,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 1),
                    (-1, 1),
                    6,
                ),
                (
                    "TOPPADDING",
                    (0, 2),
                    (-1, -1),
                    7,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 2),
                    (-1, -1),
                    7,
                ),
            ]

            if column_count > 2:
                style_commands.extend(
                    [
                        (
                            "SPAN",
                            (0, 0),
                            (1, 0),
                        ),
                        (
                            "SPAN",
                            (2, 0),
                            (-1, 0),
                        ),
                        (
                            "ALIGN",
                            (0, 0),
                            (1, 0),
                            "CENTER",
                        ),
                        (
                            "ALIGN",
                            (2, 0),
                            (-1, 0),
                            "LEFT",
                        ),
                    ]
                )
            elif column_count > 1:
                style_commands.extend(
                    [
                        (
                            "ALIGN",
                            (0, 0),
                            (0, 0),
                            "CENTER",
                        ),
                        (
                            "ALIGN",
                            (1, 0),
                            (1, 0),
                            "LEFT",
                        ),
                    ]
                )

            product_row_start = 2
            product_row_end = (
                (
                    subtotal_row_index - 1
                )
                if subtotal_row_index
                is not None
                else -1
            )

            for (
                column_index,
                column,
            ) in enumerate(
                visible_columns
            ):
                style_commands.append(
                    (
                        "ALIGN",
                        (
                            column_index,
                            product_row_start,
                        ),
                        (
                            column_index,
                            product_row_end,
                        ),
                        (
                            "LEFT"
                            if
                            column.kind
                            == "description"
                            else
                            "CENTER"
                        ),
                    )
                )

            if not segment[
                "product_indices"
            ]:
                style_commands.extend(
                    [
                        (
                            "SPAN",
                            (0, 2),
                            (-1, 2),
                        ),
                        (
                            "ALIGN",
                            (0, 2),
                            (-1, 2),
                            "CENTER",
                        ),
                    ]
                )

            if (
                subtotal_row_index
                is not None
            ):
                if column_count > 1:
                    style_commands.append(
                        (
                            "SPAN",
                            (
                                0,
                                subtotal_row_index,
                            ),
                            (
                                -2,
                                subtotal_row_index,
                            ),
                        )
                    )

                style_commands.extend(
                    [
                        (
                            "ALIGN",
                            (
                                0,
                                subtotal_row_index,
                            ),
                            (
                                -1,
                                subtotal_row_index,
                            ),
                            "RIGHT",
                        ),
                        (
                            "TOPPADDING",
                            (
                                0,
                                subtotal_row_index,
                            ),
                            (
                                -1,
                                subtotal_row_index,
                            ),
                            6,
                        ),
                        (
                            "BOTTOMPADDING",
                            (
                                0,
                                subtotal_row_index,
                            ),
                            (
                                -1,
                                subtotal_row_index,
                            ),
                            6,
                        ),
                    ]
                )

            table.setStyle(
                TableStyle(
                    style_commands
                )
            )

            story.append(
                table
            )

            story.append(
                Spacer(
                    1,
                    PART_BLOCK_GAP,
                )
            )

        is_final_page = (
            page_index
            ==
            page_count - 1
        )

        if is_final_page:
            story.append(
                Spacer(
                    1,
                    DETAIL_TOTALS_GAP,
                )
            )

            story.append(
                KeepTogether(
                    [
                        totals_table
                    ]
                )
            )


def _terms_header(
    data: QuotationData,
    body: ParagraphStyle,
    small_style: ParagraphStyle,
):
    logo = _logo_flowable(
        data.company.logoDataUrl,
    )

    if logo is None:
        logo = Table(
            [
                [
                    Paragraph(
                        "<b>LOGO</b>",
                        small_style,
                    )
                ]
            ],
            colWidths=[
                56 * mm
            ],
            rowHeights=[
                32 * mm
            ],
        )

        logo.setStyle(
            TableStyle(
                [
                    (
                        "BOX",
                        (0, 0),
                        (-1, -1),
                        0.6,
                        MID_GRAY,
                    ),
                    (
                        "ALIGN",
                        (0, 0),
                        (-1, -1),
                        "CENTER",
                    ),
                    (
                        "VALIGN",
                        (0, 0),
                        (-1, -1),
                        "MIDDLE",
                    ),
                ]
            )
        )

    terms_heading = Paragraph(
        "<b>TERMS &amp; CONDITIONS</b>",
        ParagraphStyle(
            "terms_heading",
            parent=body,
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=21,
            textColor=BLACK,
        ),
    )

    header = Table(
        [
            [
                "",
                logo,
            ],
            [
                terms_heading,
                "",
            ],
        ],
        colWidths=[
            CONTENT_WIDTH
            - 60 * mm,
            60 * mm,
        ],
    )

    header.setStyle(
        TableStyle(
            [
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP",
                ),
                (
                    "ALIGN",
                    (1, 0),
                    (1, 0),
                    "RIGHT",
                ),
                (
                    "LINEBELOW",
                    (0, 1),
                    (-1, 1),
                    0.7,
                    BLACK,
                ),
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    0,
                ),
                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    0,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, 0),
                    1.5 * mm,
                ),
                (
                    "TOPPADDING",
                    (0, 1),
                    (-1, 1),
                    0,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, 0),
                    0.5 * mm,
                ),
                (
                    "BOTTOMPADDING",
                    (0, 1),
                    (-1, 1),
                    7,
                ),
            ]
        )
    )

    return header


def _term_field(
    term: Any,
    field_name: str,
    default: Any = None,
):
    if isinstance(
        term,
        dict,
    ):
        return term.get(
            field_name,
            default,
        )

    return getattr(
        term,
        field_name,
        default,
    )


def _selected_quotation_terms(
    data: QuotationData,
) -> tuple[
    bool,
    list[str],
]:
    """
    Return:
      (has_selectable_terms, selected_term_texts)

    This is intentionally backward-compatible with old quotations
    that only contain termsAndConditions.
    """
    raw_terms = getattr(
        data,
        "terms",
        None,
    )

    has_selectable_terms = (
        isinstance(
            raw_terms,
            list,
        )
        and len(
            raw_terms
        ) > 0
    )

    if not has_selectable_terms:
        return (
            False,
            [],
        )

    selected_terms: list[str] = []

    for term in raw_terms:
        selected = bool(
            _term_field(
                term,
                "selected",
                False,
            )
        )

        term_text = str(
            _term_field(
                term,
                "text",
                "",
            )
            or ""
        ).strip()

        if (
            selected
            and term_text
        ):
            selected_terms.append(
                term_text
            )

    return (
        True,
        selected_terms,
    )


def _terms_body_style(
    body: ParagraphStyle,
) -> ParagraphStyle:
    return ParagraphStyle(
        "terms_body",
        parent=body,
        fontSize=8.2,
        leading=10.5,
        alignment=TA_LEFT,
        textColor=BLACK,
        spaceAfter=0,
    )


def _terms_subpoint_style(
    body: ParagraphStyle,
) -> ParagraphStyle:
    return ParagraphStyle(
        "terms_subpoint",
        parent=_terms_body_style(
            body
        ),
        leftIndent=11,
        firstLineIndent=0,
    )


def _split_term_blocks(
    term_text: str,
) -> list[str]:
    """
    Split long Terms & Conditions entries into readable blocks.

    Example input:
        AMC a. Scope ... b. Hardware ... c. Cloud ... d. Payment ...

    Output blocks:
        AMC
        a. Scope ...
        b. Hardware ...
        c. Cloud ...
        d. Payment ...

    Every alphabetic subpoint (a., b., c., d. ... z.) becomes its own
    paragraph/line. Existing manual line breaks are also preserved.
    """
    clean = str(
        term_text
        or ""
    ).strip()

    if not clean:
        return []

    source_lines = [
        re.sub(
            r"[ \t]+",
            " ",
            line,
        ).strip()
        for line in clean.splitlines()
        if line.strip()
    ]

    if not source_lines:
        source_lines = [
            re.sub(
                r"[ \t]+",
                " ",
                clean,
            ).strip()
        ]

    blocks: list[str] = []

    # IMPORTANT: use real regex escapes (\S, \., \s), not double-escaped
    # literals. The previous pattern therefore failed to detect a./b./c.
    marker_pattern = re.compile(
        r"(?<!\S)([a-z])\.\s+(?=\S)",
        flags=re.IGNORECASE,
    )

    for line in source_lines:
        markers = list(
            marker_pattern.finditer(
                line
            )
        )

        if not markers:
            blocks.append(
                line
            )
            continue

        prefix = line[
            : markers[0].start()
        ].strip()

        # Split when we have a real subpoint sequence (a,b,...) or when
        # the first marker is "a." after a short title such as "AMC".
        marker_letters = [
            marker.group(1).lower()
            for marker in markers
        ]

        looks_like_subpoint_list = (
            len(markers) >= 2
            or (
                marker_letters[0] == "a"
                and len(prefix) <= 60
            )
            or markers[0].start() == 0
        )

        if not looks_like_subpoint_list:
            blocks.append(
                line
            )
            continue

        if prefix:
            blocks.append(
                prefix
            )

        for index, marker in enumerate(
            markers
        ):
            end = (
                markers[index + 1].start()
                if index + 1 < len(markers)
                else len(line)
            )

            subpoint = line[
                marker.start() : end
            ].strip()

            if subpoint:
                blocks.append(
                    subpoint
                )

    return blocks


def _term_title(
    term_text: str,
    term_number: int,
) -> str:
    blocks = (
        _split_term_blocks(
            term_text
        )
    )

    if not blocks:
        return (
            f"Term {term_number}"
        )

    title = blocks[0]

    # Keep continuation headings compact for unusually long titles.
    if len(title) > 90:
        title = (
            title[:87]
            .rstrip()
            + "..."
        )

    return title


def _term_block_flowables(
    block_text: str,
    term_number: int,
    block_index: int,
    is_last_block: bool,
    body: ParagraphStyle,
) -> list:
    clean_text = safe_text(
        block_text,
        "",
    )

    if not clean_text:
        return []

    if block_index == 0:
        paragraph = Paragraph(
            (
                f"<b>{term_number}.</b> "
                f"{clean_text}"
            ),
            _terms_body_style(
                body
            ),
        )
    else:
        paragraph = Paragraph(
            clean_text,
            _terms_subpoint_style(
                body
            ),
        )

    flowables = [
        paragraph,
    ]

    flowables.append(
        Spacer(
            1,
            (
                1.2 * mm
                if is_last_block
                else 0.45 * mm
            ),
        )
    )

    return flowables



def _flowable_total_height(
    flowable,
) -> float:
    # KeepTogether.wrap() expects ReportLab to have already attached
    # a canvas. This helper is also used before document build time,
    # so measuring KeepTogether directly can raise:
    #   AttributeError: 'KeepTogether' object has no attribute 'canv'
    # Measure its child flowables instead.
    if isinstance(flowable, KeepTogether):
        content = getattr(
            flowable,
            "_content",
            None,
        )

        if content:
            return _flowables_height(
                list(content)
            )

        return 0.0

    _, height = flowable.wrap(
        CONTENT_WIDTH,
        USABLE_FRAME_HEIGHT,
    )

    space_before = (
        flowable.getSpaceBefore()
        if hasattr(
            flowable,
            "getSpaceBefore",
        )
        else 0.0
    )

    space_after = (
        flowable.getSpaceAfter()
        if hasattr(
            flowable,
            "getSpaceAfter",
        )
        else 0.0
    )

    return (
        float(height)
        + float(
            space_before
            or 0
        )
        + float(
            space_after
            or 0
        )
    )


def _flowables_height(
    flowables: list,
) -> float:
    return sum(
        _flowable_total_height(
            flowable
        )
        for flowable
        in flowables
    )


def _partition_terms_into_blocks(
    terms: list[str],
    body: ParagraphStyle,
    page_budget: float,
) -> list[list[dict[str, Any]]]:
    """
    Split Terms & Conditions at explicit line/subpoint boundaries.

    A normal one-line term stays together. A multiline term such as
    AMC can continue onto the next page, so unused page space is not
    wasted simply because the complete term is taller than the
    remaining area.
    """
    flat_blocks: list[
        dict[str, Any]
    ] = []

    for term_index, term_text in enumerate(
        terms
    ):
        term_number = (
            term_index + 1
        )

        blocks = (
            _split_term_blocks(
                term_text
            )
        )

        for block_index, block_text in enumerate(
            blocks
        ):
            flat_blocks.append(
                {
                    "term_index":
                        term_index,
                    "term_number":
                        term_number,
                    "block_index":
                        block_index,
                    "block_text":
                        block_text,
                    "is_last_block":
                        (
                            block_index
                            ==
                            len(blocks) - 1
                        ),
                }
            )

    if not flat_blocks:
        return [[]]

    pages: list[
        list[
            dict[str, Any]
        ]
    ] = []

    current_page: list[
        dict[str, Any]
    ] = []

    current_height = 0.0

    for block in flat_blocks:
        block_flowables = (
            _term_block_flowables(
                block[
                    "block_text"
                ],
                block[
                    "term_number"
                ],
                block[
                    "block_index"
                ],
                block[
                    "is_last_block"
                ],
                body,
            )
        )

        block_height = max(
            16.0,
            _flowables_height(
                block_flowables
            ),
        )

        if (
            current_page
            and
            current_height
            + block_height
            > page_budget
        ):
            pages.append(
                current_page
            )

            current_page = []
            current_height = 0.0

        current_page.append(
            {
                "kind":
                    "block",
                **block,
            }
        )

        current_height += (
            block_height
        )

    if current_page:
        pages.append(
            current_page
        )

    return pages



def _append_terms_page_items(
    story: list,
    items: list[
        dict[str, Any]
    ],
    body: ParagraphStyle,
):
    for item in items:
        story.extend(
            _term_block_flowables(
                item[
                    "block_text"
                ],
                item[
                    "term_number"
                ],
                item[
                    "block_index"
                ],
                item[
                    "is_last_block"
                ],
                body,
            )
        )



def _append_legacy_terms_content(
    story: list,
    data: QuotationData,
    body: ParagraphStyle,
):
    terms_text = (
        data.termsAndConditions
        or
        "No Terms & Conditions specified."
    ).strip()

    terms_style = ParagraphStyle(
        "legacy_terms_body",
        parent=body,
        fontSize=9,
        leading=12,
        alignment=TA_LEFT,
        textColor=BLACK,
        spaceAfter=6,
    )

    blocks = re.split(
        r"\n\s*\n",
        terms_text,
    )

    for block in blocks:
        clean_block = (
            safe_text(
                block,
                "",
            )
            .replace(
                "\n",
                "<br/>",
            )
        )

        if not clean_block:
            continue

        story.append(
            Paragraph(
                clean_block,
                terms_style,
            )
        )

        story.append(
            Spacer(
                1,
                1.5 * mm,
            )
        )


def _terms_closing_sections(
    data: QuotationData,
    body: ParagraphStyle,
) -> list[list]:
    """Build the closing section as measured chunks.

    The chunks let the final Terms page use its remaining space while
    ensuring that any continuation page starts with the company logo.
    """
    closing_style = ParagraphStyle(
        "terms_closing_note",
        parent=body,
        fontSize=9,
        leading=13,
        alignment=TA_LEFT,
        textColor=BLACK,
        spaceAfter=7,
    )

    offer_section = [
        Paragraph(
            safe_text(
                "We hope you will find our offer quite competitive and in line with your requirements and request you to favor us with your value order."
            ),
            closing_style,
        ),
        Spacer(1, 2 * mm),
    ]

    clarification_section = [
        Paragraph(
            safe_text(
                "In case you need, any further clarifications on the subject please feel free to contact us thanking you and assuring you of our best services at all times."
            ),
            closing_style,
        ),
        Spacer(1, 2 * mm),
    ]

    company_name = (
        data.company.name
        or data.company.footerLine1
        or "—"
    )

    signature_flowables = []
    signature_image = None

    signature_image = _signature_flowable(
        data.company.signatureImageDataUrl or "",
    )

    if signature_image is not None:
        signature_flowables.append(signature_image)
        signature_flowables.append(Spacer(1, 3 * mm))
    else:
        # Preserve the signature area even when no image is uploaded.
        signature_flowables.append(Spacer(1, 14 * mm))

    signature_label = Table(
        [[
            Paragraph(
                "<b>Authorized Signatory</b>",
                ParagraphStyle(
                    "signature_label",
                    parent=body,
                    fontSize=9,
                    leading=12,
                ),
            )
        ]],
        colWidths=[48 * mm],
        hAlign="LEFT",
    )

    signature_label.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    signature_flowables.append(signature_label)

    signatory_section = [
        Paragraph("Thanking you", closing_style),
        Spacer(1, 7 * mm),
        Paragraph(
            f"<b>{safe_text(company_name)}</b>",
            ParagraphStyle(
                "terms_company_name",
                parent=body,
                fontName="Helvetica-Bold",
                fontSize=9,
                leading=12,
            ),
        ),
        *signature_flowables,
        Spacer(1, 8 * mm),
    ]

    bank_table = Table(
        [
            [
                Paragraph("<b>Account Name</b>", body),
                Paragraph("ALPHANUMERIC INNOVATIONS PVT LTD", body),
            ],
            [
                Paragraph("<b>Account Number</b>", body),
                Paragraph("50200123600412", body),
            ],
            [
                Paragraph("<b>IFSC Code</b>", body),
                Paragraph("HDFC0009607", body),
            ],
            [
                Paragraph("<b>Branch Name</b>", body),
                Paragraph("Hitech City-3", body),
            ],
        ],
        colWidths=[
            48 * mm,
            CONTENT_WIDTH - 48 * mm,
        ],
        hAlign="LEFT",
    )

    bank_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.65, MID_GRAY),
                ("INNERGRID", (0, 0), (-1, -1), 0.55, MID_GRAY),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("BACKGROUND", (0, 0), (-1, -1), WHITE),
            ]
        )
    )

    bank_section = [
        Paragraph(
            "<b>BANK DETAILS</b>",
            ParagraphStyle(
                "bank_details_heading",
                parent=body,
                fontName="Helvetica-Bold",
                fontSize=11,
                leading=14,
                textColor=BLACK,
                spaceAfter=5,
            ),
        ),
        bank_table,
    ]

    return [
        offer_section,
        clarification_section,
        signatory_section,
        bank_section,
    ]


def _append_terms_closing_details(
    story: list,
    data: QuotationData,
    body: ParagraphStyle,
):
    for section in _terms_closing_sections(data, body):
        story.extend(section)


def _append_closing_sections_with_logo_on_overflow(
    story: list,
    data: QuotationData,
    body: ParagraphStyle,
    small_style: ParagraphStyle,
    remaining_height: float,
):
    """Use remaining Terms-page space and add a logo on continuation pages."""
    sections = _terms_closing_sections(data, body)
    remaining = max(0.0, float(remaining_height))

    first_section = True

    for section in sections:
        # Use a modest gap only before the first closing paragraph.
        prefix = [Spacer(1, 5 * mm)] if first_section else []
        candidate = prefix + section
        candidate_height = _flowables_height(candidate)

        if candidate_height <= remaining:
            story.extend(candidate)
            remaining -= candidate_height
            first_section = False
            continue

        # The next closing chunk does not fit. Start a fresh page and
        # explicitly restore the logo before continuing the closing data.
        story.append(PageBreak())
        logo_header = _logo_header(data, small_style)
        story.append(logo_header)
        story.append(Spacer(1, 2.5 * mm))

        remaining = (
            USABLE_FRAME_HEIGHT
            - _measure_table_height(logo_header)
            - 2.5 * mm
        )

        story.extend(section)
        remaining -= _flowables_height(section)
        first_section = False


def _build_terms_page(
    story: list,
    data: QuotationData,
    body: ParagraphStyle,
    small_style: ParagraphStyle,
):
    """
    Build Terms & Conditions pages using measured content height.

    The PDF no longer uses a fixed number of terms per page.
    Each Terms page is filled with as many complete terms as will
    fit. The closing note, company/signature block and bank details
    are appended immediately after the final term and use any
    remaining space before ReportLab creates another page.
    """
    (
        has_selectable_terms,
        selected_terms,
    ) = _selected_quotation_terms(
        data
    )

    if not has_selectable_terms:
        story.append(
            _terms_header(
                data,
                body,
                small_style,
            )
        )

        story.append(
            Spacer(
                1,
                TERMS_PAGE_GAP,
            )
        )

        _append_legacy_terms_content(
            story,
            data,
            body,
        )

        story.append(
            Spacer(
                1,
                6 * mm,
            )
        )

        _append_terms_closing_details(
            story,
            data,
            body,
        )

        return

    if not selected_terms:
        story.append(
            _terms_header(
                data,
                body,
                small_style,
            )
        )

        story.append(
            Spacer(
                1,
                TERMS_PAGE_GAP,
            )
        )

        story.append(
            Paragraph(
                "No Terms &amp; Conditions selected.",
                ParagraphStyle(
                    "no_selected_terms",
                    parent=body,
                    fontSize=9,
                    leading=12,
                    alignment=TA_LEFT,
                    textColor=BLACK,
                ),
            )
        )

        story.append(
            Spacer(
                1,
                6 * mm,
            )
        )

        _append_terms_closing_details(
            story,
            data,
            body,
        )

        return

    header_sample = _terms_header(
        data,
        body,
        small_style,
    )

    header_height = (
        _measure_table_height(
            header_sample
        )
    )

    terms_page_budget = max(
        120.0,
        USABLE_FRAME_HEIGHT
        - header_height
        - TERMS_PAGE_GAP
        - TERMS_PAGE_SAFETY,
    )

    term_pages = (
        _partition_terms_into_blocks(
            selected_terms,
            body,
            terms_page_budget,
        )
    )

    for page_index, page_items in enumerate(
        term_pages
    ):
        if page_index > 0:
            story.append(
                PageBreak()
            )

        story.append(
            _terms_header(
                data,
                body,
                small_style,
            )
        )

        story.append(
            Spacer(
                1,
                TERMS_PAGE_GAP,
            )
        )

        _append_terms_page_items(
            story,
            page_items,
            body,
        )

    # Use all available space after the final term. If a later closing
    # chunk has to continue on another page, that continuation page
    # explicitly starts with the company logo.
    last_page_items = (
        term_pages[-1]
        if term_pages
        else []
    )

    last_page_flowables = []
    for item in last_page_items:
        last_page_flowables.extend(
            _term_block_flowables(
                item["block_text"],
                item["term_number"],
                item["block_index"],
                item["is_last_block"],
                body,
            )
        )

    last_terms_height = _flowables_height(
        last_page_flowables
    )

    remaining_height = max(
        0.0,
        USABLE_FRAME_HEIGHT
        - header_height
        - TERMS_PAGE_GAP
        - last_terms_height
        - TERMS_PAGE_SAFETY,
    )

    _append_closing_sections_with_logo_on_overflow(
        story,
        data,
        body,
        small_style,
        remaining_height,
    )



def build_pdf(
    data: QuotationData,
) -> tuple[
    bytes,
    str,
]:
    output = io.BytesIO()

    doc = SimpleDocTemplate(
        output,
        pagesize=A4,
        leftMargin=
            LEFT_MARGIN,
        rightMargin=
            RIGHT_MARGIN,
        topMargin=
            TOP_MARGIN,
        bottomMargin=
            BOTTOM_MARGIN,
        title=(
            data.quote.quoteNumber
            or
            "Quotation"
        ),
        author=(
            data.company.name
            or
            "Alpha Numeric Innovations"
        ),
        allowSplitting=True,
    )

    styles = (
        getSampleStyleSheet()
    )

    body = ParagraphStyle(
        "bw_body",
        parent=
            styles[
                "BodyText"
            ],
        fontName=
            "Helvetica",
        fontSize=9,
        leading=12,
        textColor=BLACK,
        alignment=TA_LEFT,
    )

    body_center = ParagraphStyle(
        "bw_body_center",
        parent=body,
        alignment=TA_CENTER,
    )

    body_right = ParagraphStyle(
        "bw_body_right",
        parent=body,
        alignment=TA_RIGHT,
    )

    label_style = ParagraphStyle(
        "bw_label",
        parent=body,
        fontName=
            "Helvetica-Bold",
        fontSize=9,
        leading=12,
    )

    small_style = ParagraphStyle(
        "bw_small",
        parent=body,
        fontSize=7.5,
        leading=10,
        textColor=DARK_GRAY,
    )

    heading_style = ParagraphStyle(
        "bw_heading",
        parent=
            styles[
                "Heading1"
            ],
        fontName=
            "Helvetica-Bold",
        fontSize=18,
        leading=21,
        alignment=TA_CENTER,
        textColor=BLACK,
        spaceAfter=0,
        spaceBefore=0,
    )

    story = []

    _build_abstract_page(
        story,
        data,
        body,
        body_center,
        body_right,
        label_style,
        heading_style,
        small_style,
    )

    story.append(
        PageBreak()
    )

    _build_detail_pages(
        story,
        data,
        body,
        body_center,
        body_right,
        small_style,
    )

    story.append(
        PageBreak()
    )

    _build_terms_page(
        story,
        data,
        body,
        small_style,
    )

    def draw_footer(
        canvas,
        document,
    ):
        _draw_page_footer(
            canvas,
            document,
            data,
        )

    doc.build(
        story,
        onFirstPage=
            draw_footer,
        onLaterPages=
            draw_footer,
    )

    pdf_bytes = (
        output.getvalue()
    )

    output.close()

    filename = (
        safe_filename(
            data.quote.quoteNumber
            or
            "quotation"
        )
        +
        ".pdf"
    )

    return (
        pdf_bytes,
        filename,
    )
