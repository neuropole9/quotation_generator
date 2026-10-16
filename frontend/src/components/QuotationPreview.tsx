import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type {
  ProductLine,
  QuotationColumn,
  QuotationData,
  QuotationTerm,
} from "../types/quotation";

import {
  lineBase,
} from "../utils/calculations";

/*
 * The preview page CSS is A4-like:
 * 794 x 1123 px with 48 px top padding and
 * 105 px bottom padding reserved for the footer.
 */
const DETAIL_INNER_HEIGHT = 905;
const DETAIL_GAP = 14;
const DETAIL_SAFETY = 8;
const GLOBAL_GST_RATE = 18;

const TERMS_INNER_HEIGHT = 905;
const TERMS_GAP = 14;
const TERMS_SAFETY = 14;
const TERMS_LIST_OVERHEAD = 8;

const QUOTATION_FONT =
  "Helvetica, Arial, sans-serif";

const HEADING_STYLE = {
  fontFamily: QUOTATION_FONT,
  fontSize: "18px",
  lineHeight: "22px",
  fontWeight: 700,
  letterSpacing: "0",
  textTransform:
    "uppercase" as const,
};

const PART_HEADER_HEIGHT = 58;
const PART_SUBTOTAL_HEIGHT = 38;
const PART_EMPTY_ROW_HEIGHT = 38;
const PART_BLOCK_GAP = 14;

interface DetailPartSegment {
  partId: string;
  partIndex: number;
  partDescription: string;
  productIndices: number[];
  serialStart: number;
  continued: boolean;
  showSubtotal: boolean;
  rowHeights: number[];
}

interface DetailPageGroup {
  segments: DetailPartSegment[];
}

interface TermBlock {
  key: string;
  termId: string;
  termIndex: number;
  blockIndex: number;
  text: string;
  title: string;
  isLastBlock: boolean;
}

interface TermsPageGroup {
  blocks: TermBlock[];
  usedHeight: number;
}

const valueOrDash = (
  value?: string,
) => value?.trim() || "—";

const money = (
  value: number,
) =>
  Number(
    value || 0,
  ).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  );

const getPartLetterLabel = (
  index: number,
) => {
  let value =
    Math.max(0, index);

  let label = "";

  do {
    label =
      String.fromCharCode(
        65 +
          (value % 26),
      ) +
      label;

    value =
      Math.floor(
        value / 26,
      ) - 1;
  } while (value >= 0);

  return `PART ${label}`;
};



const resolveProductPartId = (
  product: ProductLine,
  data: QuotationData,
) => {
  const requested =
    product.abstractItemId?.trim() ||
    "";

  if (
    requested &&
    data.abstractItems.some(
      (item) =>
        item.id === requested,
    )
  ) {
    return requested;
  }

  return (
    data.abstractItems[0]?.id ||
    ""
  );
};

const getPartProductIndices = (
  data: QuotationData,
  partId: string,
) =>
  data.products.reduce<number[]>(
    (
      indices,
      product,
      productIndex,
    ) => {
      if (
        resolveProductPartId(
          product,
          data,
        ) === partId
      ) {
        indices.push(
          productIndex,
        );
      }

      return indices;
    },
    [],
  );


const isModelColumn = (
  column: QuotationColumn,
) =>
  column.kind ===
    "modelNumber" ||
  column.kind === "image";

const displayColumnLabel = (
  column: QuotationColumn,
) => {
  if (
    isModelColumn(
      column,
    )
  ) {
    return "MODEL NUMBER";
  }

  if (
    column.kind ===
    "unitPrice"
  ) {
    return "PRICE";
  }

  if (
    column.kind ===
    "amount"
  ) {
    return "TOTAL";
  }

  return (
    column.label ||
    "Column"
  );
};

const getColumnWeight = (
  column: QuotationColumn,
): number => {
  switch (column.kind) {
    case "serial":
      return 0.55;

    case "modelNumber":
    case "image":
      return 1.45;

    case "description":
      return 3.2;

    case "unit":
      return 0.8;

    case "quantity":
      return 0.8;

    case "unitPrice":
      return 1.2;

    case "gstRate":
      return 0.8;

    case "amount":
      return 1.35;

    case "customText":
      return 1.6;

    case "customNumber":
      return 1;

    case "customCurrency":
      return 1.25;

    default:
      return 1;
  }
};

const getColumnWidths = (
  columns: QuotationColumn[],
) => {
  const weights =
    columns.map(
      getColumnWeight,
    );

  const total =
    weights.reduce(
      (
        sum,
        weight,
      ) => sum + weight,
      0,
    ) || 1;

  return weights.map(
    (weight) =>
      `${(
        (weight / total) *
        100
      ).toFixed(4)}%`,
  );
};

const getModelNumber = (
  product: ProductLine,
) =>
  product.modelNumber?.trim() ||
  String(
    product.customValues?.modelNumber ??
      "",
  ).trim() ||
  "—";

const getColumnValue = (
  column: QuotationColumn,
  product: ProductLine,
  globalIndex: number,
): ReactNode => {
  switch (column.kind) {
    case "serial":
      return globalIndex + 1;

    case "modelNumber":
    case "image":
      return getModelNumber(
        product,
      );

    case "description":
      return (
        product.description ||
        "Product / service"
      );

    case "unit":
      return (
        product.unit ||
        "—"
      );

    case "quantity":
      return Number(
        product.quantity || 0,
      ).toLocaleString(
        "en-IN",
      );

    case "unitPrice":
      return money(
        product.unitPrice,
      );

    case "gstRate":
      return `${Number(
        product.gstRate || 0,
      )}%`;

    case "amount":
      return money(
        lineBase(product),
      );

    case "customCurrency": {
      const value =
        Number(
          product.customValues?.[
            column.id
          ] ?? 0,
        );

      return money(
        Number.isFinite(value)
          ? value
          : 0,
      );
    }

    case "customNumber":
      return (
        product.customValues?.[
          column.id
        ] ?? "—"
      );

    case "customText":
    default:
      return String(
        product.customValues?.[
          column.id
        ] ?? "—",
      );
  }
};

function DocumentFooter({
  data,
  pageNumber,
}: {
  data: QuotationData;
  pageNumber: number;
}) {
  // Footer Line 1 / Footer Line 2 are the exact editable
  // source of truth for both Preview and the downloaded PDF.
  // Do not fall back to the company fields when either line is cleared.
  const companyName =
    data.company
      .footerLine1
      ?.trim() ??
    "";

  const companyDetails =
    data.company
      .footerLine2
      ?.trim() ??
    "";

  return (
    <footer
      key={`${companyName}::${companyDetails}::${pageNumber}`}
      className="bw-page-footer"
    >
      <div className="bw-footer-rule" />

      {companyName ? (
        <strong className="bw-footer-company">
          {companyName}
        </strong>
      ) : null}

      {companyDetails ? (
        <div
          className="bw-footer-details"
          style={{
            width: "calc(100% - 40px)",
            maxWidth: "100%",
            margin: "0 auto",
            padding: "0 8px",
            fontSize: "10.5px",
            lineHeight: 1.25,
            textAlign: "center",
            whiteSpace: "normal",
            overflowWrap: "anywhere",
            wordBreak: "normal",
          }}
        >
          {companyDetails}
        </div>
      ) : null}

      <span className="bw-footer-page-number">
        Page {pageNumber}
      </span>

      <span
        className="bw-footer-auto-generated"
        style={{
          position: "absolute",
          left: 0,
          bottom: "-18px",
          fontSize: "9px",
          color: "#666666",
          fontWeight: 500,
        }}
      >
        Auto Generated Quote
      </span>
    </footer>
  );
}

function DocumentLogo({
  data,
}: {
  data: QuotationData;
}) {
  return (
    <div
      className="bw-logo-area"
      style={{
        width: "176px",
        height: "100px",
        display: "flex",
        alignItems:
          "flex-start",
        justifyContent:
          "flex-end",
        alignSelf:
          "flex-start",
        marginTop: 0,
        marginLeft:
          "auto",
      }}
    >
      {data.company
        .logoDataUrl ? (
        <img
          className="bw-company-logo"
          src={
            data.company
              .logoDataUrl
          }
          alt="Company logo"
          style={{
            width: "168px",
            height: "92px",
            objectFit:
              "contain",
            objectPosition:
              "right top",
          }}
        />
      ) : (
        <div
          className="bw-logo-placeholder"
          style={{
            width: "168px",
            height: "92px",
          }}
        >
          LOGO
        </div>
      )}
    </div>
  );
}

function AbstractPage({
  data,
  pageNumber,
}: {
  data: QuotationData;
  pageNumber: number;
}) {
  const abstractTotal =
    data.abstractItems.reduce(
      (
        total,
        item,
      ) =>
        total +
        Number(
          item.price || 0,
        ),
      0,
    );

  return (
    <article
      className="bw-page bw-abstract-page"
      style={{
        fontFamily:
          QUOTATION_FONT,
      }}
    >
      <div className="bw-page-top">
        <div />
        <DocumentLogo
          data={data}
        />
      </div>

      <table className="bw-info-table bw-client-project-table">
        <tbody>
          <tr>
            <th>
              Client Name
            </th>
            <td>
              {valueOrDash(
                data.customer
                  .name ||
                  data.customer
                    .company,
              )}
            </td>
            <th>
              Project Name
            </th>
            <td>
              {valueOrDash(
                data.quote
                  .projectName,
              )}
            </td>
          </tr>

          <tr>
            <th>
              Client Number
            </th>
            <td>
              {valueOrDash(
                data.customer
                  .phone,
              )}
            </td>
            <th>
              MEP Details
            </th>
            <td>
              {valueOrDash(
                data.quote
                  .mepDetails,
              )}
            </td>
          </tr>

          <tr>
            <th>
              Client Address
            </th>
            <td
              colSpan={3}
              className="bw-address-cell"
            >
              {valueOrDash(
                data.customer
                  .address,
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* New 3-row client information table */}
      <table className="bw-info-table bw-client-extra-table">
        <tbody>
          <tr>
            <th>
              Client GST No.
            </th>
            <td>
              {valueOrDash(
                data.customer
                  .gstNo,
              )}
            </td>
          </tr>

          <tr>
            <th>
              Client Email
            </th>
            <td>
              {valueOrDash(
                data.customer
                  .email,
              )}
            </td>
          </tr>

          <tr>
            <th>
              Site Location
            </th>
            <td>
              {valueOrDash(
                data.quote
                  .siteLocation,
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="bw-info-table bw-quotation-info-table">
        <tbody>
          <tr>
            <th>Qt. No</th>
            <td>
              {valueOrDash(
                data.quote
                  .quoteNumber,
              )}
            </td>
          </tr>

          <tr>
            <th>Qt. Date</th>
            <td>
              {valueOrDash(
                data.quote
                  .quoteDate,
              )}
            </td>
          </tr>

          <tr>
            <th>
              Qt. Details
            </th>
            <td>
              {valueOrDash(
                data.quote
                  .quoteDetails,
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <h1
        className="bw-page-heading"
        style={HEADING_STYLE}
      >
        ABSTRACT
      </h1>

      <table className="bw-abstract-table">
        <thead>
          <tr>
            <th className="bw-abstract-serial">
              SL.NO
            </th>
            <th className="bw-abstract-part">
              PARTS
            </th>
            <th>
              DESCRIPTION
            </th>
            <th className="bw-abstract-price">
              PRICE
            </th>
          </tr>
        </thead>

        <tbody>
          {data.abstractItems.map(
            (
              item,
              index,
            ) => (
              <tr
                key={item.id}
              >
                <td>
                  {index + 1}
                </td>

                <td className="bw-abstract-part-cell">
                  {getPartLetterLabel(
                    index,
                  )}
                </td>

                <td className="bw-description-cell">
                  {item.description ||
                    "—"}
                </td>

                <td>
                  {Number(
                    item.price || 0,
                  ).toLocaleString(
                    "en-IN",
                    {
                      minimumFractionDigits:
                        2,
                      maximumFractionDigits:
                        2,
                    },
                  )}
                </td>
              </tr>
            ),
          )}

          <tr className="bw-abstract-total-row">
            <td
              colSpan={3}
            >
              <strong>
                Total Amount
              </strong>
            </td>
            <td>
              <strong>
                {Number(
                  abstractTotal,
                ).toLocaleString(
                  "en-IN",
                  {
                    minimumFractionDigits:
                      2,
                    maximumFractionDigits:
                      2,
                  },
                )}
              </strong>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="bw-gst-note">
        Excluding GST
      </div>

      {data.notes?.trim() ? (
        <div className="bw-page-note">
          <strong>
            Note:
          </strong>{" "}
          {data.notes}
        </div>
      ) : null}

      <DocumentFooter
        data={data}
        pageNumber={
          pageNumber
        }
      />
    </article>
  );
}

function DetailHeader({
  data,
}: {
  data: QuotationData;
}) {
  return (
    <div className="bw-detail-header">
      <DocumentLogo
        data={data}
      />

      <div className="bw-detail-title-block">
        <h1
          style={HEADING_STYLE}
        >
          PRODUCT DETAILS
        </h1>

        <p>
          Quotation No:{" "}
          <strong>
            {valueOrDash(
              data.quote
                .quoteNumber,
            )}
          </strong>
        </p>
      </div>
    </div>
  );
}

function DetailTotals({
  data,
}: {
  data: QuotationData;
}) {
  const subtotal =
    data.products.reduce(
      (
        total,
        product,
      ) =>
        total +
        lineBase(product),
      0,
    );

  const totalGst =
    subtotal *
    GLOBAL_GST_RATE /
    100;

  const grandTotal =
    subtotal + totalGst;

  return (
    <div className="bw-detail-totals-wrap">
      <table
        className="bw-detail-totals"
        style={{
          width: "100%",
          tableLayout: "fixed",
        }}
      >
        <tbody>
          <tr>
            <th>
              Subtotal
            </th>
            <td>
              {money(
                subtotal,
              )}
            </td>
          </tr>

          <tr>
            <th>
              GST {GLOBAL_GST_RATE}%
            </th>
            <td>
              {money(
                totalGst,
              )}
            </td>
          </tr>

          <tr className="bw-grand-total-row">
            <th>
              Grand Total
            </th>
            <td>
              {money(
                grandTotal,
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PartProductTable({
  data,
  partNumber,
  description,
  continued,
  fullPartProductIndices,
  productIndices,
  visibleColumns,
  rowHeights,
  serialStart,
  showSubtotal,
}: {
  data: QuotationData;
  partNumber: number;
  description: string;
  continued: boolean;
  fullPartProductIndices: number[];
  productIndices: number[];
  visibleColumns:
    QuotationColumn[];
  rowHeights: number[];
  serialStart: number;
  showSubtotal: boolean;
}) {
  const widths =
    getColumnWidths(
      visibleColumns,
    );

  const columnCount =
    Math.max(
      1,
      visibleColumns.length,
    );

  const subtotal =
    fullPartProductIndices.reduce(
      (
        total,
        productIndex,
      ) =>
        total +
        lineBase(
          data.products[
            productIndex
          ],
        ),
      0,
    );

  const partLabel =
    getPartLetterLabel(
      partNumber - 1,
    );

  const basePartDescription =
    description.trim() ||
    `Abstract Row ${partNumber}`;

  const partDescription =
    continued
      ? `${basePartDescription} (Continued)`
      : basePartDescription;

  const partLabelColumnSpan =
    columnCount >= 3
      ? 2
      : 1;

  const partDescriptionColumnSpan =
    Math.max(
      1,
      columnCount -
        partLabelColumnSpan,
    );

  return (
    <table className="bw-product-table bw-part-product-table">
      <colgroup>
        {visibleColumns.map(
          (
            column,
            index,
          ) => (
            <col
              key={column.id}
              style={{
                width:
                  widths[index],
              }}
            />
          ),
        )}
      </colgroup>

      <thead>
        {columnCount > 1 ? (
          <tr className="bw-part-row">
            <td
              className="bw-part-row__number"
              colSpan={
                partLabelColumnSpan
              }
              style={{
                whiteSpace:
                  "nowrap",
              }}
            >
              {partLabel}
            </td>

            <td
              className="bw-part-row__description"
              colSpan={
                partDescriptionColumnSpan
              }
            >
              {partDescription}
            </td>
          </tr>
        ) : (
          <tr className="bw-part-row">
            <td className="bw-part-row__description">
              <strong>
                {partLabel}
              </strong>{' '}
              — {partDescription}
            </td>
          </tr>
        )}

        <tr className="bw-product-column-header">
          {visibleColumns.map(
            (column) => (
              <th
                key={column.id}
              >
                {displayColumnLabel(
                  column,
                )}
              </th>
            ),
          )}
        </tr>
      </thead>

      <tbody>
        {productIndices.length ===
        0 ? (
          <tr
            className="bw-empty-part-row"
            style={{
              height:
                `${PART_EMPTY_ROW_HEIGHT}px`,
            }}
          >
            <td
              colSpan={
                columnCount
              }
            >
              No products added for this part.
            </td>
          </tr>
        ) : (
          productIndices.map(
            (
              productIndex,
              localIndex,
            ) => {
              const product =
                data.products[
                  productIndex
                ];

              return (
                <tr
                  key={product.id}
                  style={{
                    height:
                      `${rowHeights[
                        localIndex
                      ] ?? 44}px`,
                  }}
                >
                  {visibleColumns.map(
                    (column) => (
                      <td
                        key={
                          column.id
                        }
                        className={
                          column.kind ===
                          'description'
                            ? 'bw-description-cell'
                            : isModelColumn(
                                  column,
                                )
                              ? 'bw-model-number-cell'
                              : ''
                        }
                      >
                        {getColumnValue(
                          column,
                          product,
                          serialStart +
                            localIndex,
                        )}
                      </td>
                    ),
                  )}
                </tr>
              );
            },
          )
        )}

        {showSubtotal ? (
          columnCount > 1 ? (
            <tr className="bw-part-subtotal-row">
              <th
                colSpan={
                  columnCount - 1
                }
              >
                {getPartLetterLabel(
                  partNumber - 1,
                )} Subtotal
              </th>

              <td>
                {money(
                  subtotal,
                )}
              </td>
            </tr>
          ) : (
            <tr className="bw-part-subtotal-row">
              <td>
                {getPartLetterLabel(
                  partNumber - 1,
                )} Subtotal:{' '}
                <strong>
                  {money(
                    subtotal,
                  )}
                </strong>
              </td>
            </tr>
          )
        ) : null}
      </tbody>
    </table>
  );
}

function DetailPage({
  data,
  page,
  pageNumber,
  pageIndex,
  totalDetailPages,
  visibleColumns,
}: {
  data: QuotationData;
  page: DetailPageGroup;
  pageNumber: number;
  pageIndex: number;
  totalDetailPages: number;
  visibleColumns:
    QuotationColumn[];
}) {
  const isLast =
    pageIndex ===
    totalDetailPages - 1;

  return (
    <article
      className="bw-page bw-detail-page"
      style={{
        fontFamily:
          QUOTATION_FONT,
      }}
    >
      <DetailHeader
        data={data}
      />

      {totalDetailPages >
      1 ? (
        <div className="bw-detail-continuation">
          Product Details —{" "}
          {pageIndex + 1} of{" "}
          {totalDetailPages}
        </div>
      ) : null}

      <div className="bw-parts-detail">
        {page.segments.map(
          (
            segment,
            segmentIndex,
          ) => {
            const fullPartIndices =
              getPartProductIndices(
                data,
                segment.partId,
              );

            return (
              <section
                className="bw-part-block"
                key={`${segment.partId}-${pageIndex}-${segmentIndex}`}
              >
                <PartProductTable
                  data={data}
                  partNumber={
                    segment.partIndex +
                    1
                  }
                  description={
                    segment.partDescription
                  }
                  continued={
                    segment.continued
                  }
                  fullPartProductIndices={
                    fullPartIndices
                  }
                  productIndices={
                    segment.productIndices
                  }
                  visibleColumns={
                    visibleColumns
                  }
                  rowHeights={
                    segment.rowHeights
                  }
                  serialStart={
                    segment.serialStart
                  }
                  showSubtotal={
                    segment.showSubtotal
                  }
                />
              </section>
            );
          },
        )}
      </div>

      {isLast ? (
        <DetailTotals
          data={data}
        />
      ) : null}

      <DocumentFooter
        data={data}
        pageNumber={
          pageNumber
        }
      />
    </article>
  );
}


function buildTermBlocks(
  terms: QuotationTerm[],
): TermBlock[] {
  return terms.flatMap(
    (
      term,
      termIndex,
    ) => {
      const lines =
        term.text
          .split(/\r?\n/)
          .map(
            (line) =>
              line.trim(),
          )
          .filter(Boolean);

      const safeLines =
        lines.length > 0
          ? lines
          : [
              term.text.trim(),
            ];

      const title =
        safeLines[0] ||
        `Term ${termIndex + 1}`;

      return safeLines.map(
        (
          line,
          blockIndex,
        ) => ({
          key:
            `${term.id}-${blockIndex}`,
          termId:
            term.id,
          termIndex,
          blockIndex,
          text:
            line,
          title,
          isLastBlock:
            blockIndex ===
            safeLines.length - 1,
        }),
      );
    },
  );
}


function buildTermsPageGroups({
  blocks,
  blockHeights,
  pageBudget,
}: {
  blocks: TermBlock[];
  blockHeights: number[];
  pageBudget: number;
}): TermsPageGroup[] {
  if (blocks.length === 0) {
    return [
      {
        blocks: [],
        usedHeight: 0,
      },
    ];
  }

  const pages:
    TermsPageGroup[] = [];

  let currentBlocks:
    TermBlock[] = [];

  let currentHeight = 0;

  const pushCurrentPage =
    () => {
      if (
        currentBlocks.length ===
        0
      ) {
        return;
      }

      pages.push({
        blocks:
          currentBlocks,
        usedHeight:
          currentHeight,
      });

      currentBlocks = [];
      currentHeight = 0;
    };

  blocks.forEach(
    (
      block,
      index,
    ) => {
      const measuredHeight =
        Math.max(
          20,
          blockHeights[index] ??
            30,
        );

      const wouldOverflow =
        currentBlocks.length >
          0 &&
        currentHeight +
          measuredHeight >
          pageBudget;

      if (wouldOverflow) {
        pushCurrentPage();
      }

      currentBlocks.push(
        block,
      );

      currentHeight +=
        measuredHeight;
    },
  );

  pushCurrentPage();

  return pages;
}



function TermsBlockRow({
  block,
}: {
  block: TermBlock;
}) {
  return (
    <div
      className="bw-term-block-row"
      style={{
        display: "grid",
        gridTemplateColumns:
          "34px minmax(0, 1fr)",
        columnGap: "4px",
        marginBottom:
          block.isLastBlock
            ? "8px"
            : "2px",
        breakInside: "avoid",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          textAlign: "right",
          paddingRight: "2px",
        }}
      >
        {block.blockIndex ===
        0
          ? `${block.termIndex + 1}.`
          : ""}
      </div>

      <div
        style={{
          whiteSpace:
            "pre-line",
          minWidth: 0,
        }}
      >
        {block.text}
      </div>
    </div>
  );
}



function TermsClosingDetails({
  data,
}: {
  data: QuotationData;
}) {
  const companyName =
    data.company.name?.trim() ||
    data.company.footerLine1?.trim() ||
    "—";

  const bankRows = [
    [
      "Account Name",
      "ALPHANUMERIC INNOVATIONS PVT LTD",
    ],
    [
      "Account Number",
      "50200123600412",
    ],
    [
      "IFSC Code",
      "HDFC0009607",
    ],
    [
      "Branch Name",
      "Hitech City-3",
    ],
  ];

  return (
    <div className="bw-terms-company-signature">
      <div
        className="bw-terms-closing-note"
        style={{
          marginBottom: "28px",
          fontSize: "13px",
          lineHeight: 1.6,
          textAlign: "left",
        }}
      >
        <p style={{ margin: "0 0 14px" }}>
          We hope you will find our offer quite competitive and in line with your requirements and request you to favor us with your value order.
        </p>

        <p style={{ margin: "0 0 14px" }}>
          In case you need, any further clarifications on the subject please feel free to contact us thanking you and assuring you of our best services at all times.
        </p>

        <p style={{ margin: 0 }}>
          Thanking you
        </p>
      </div>

      <div className="bw-terms-company-name">
        {companyName}
      </div>

      <div className="bw-signature-preview-block">
        {data.company
          .signatureImageDataUrl ? (
          <img
            className="bw-signature-image"
            src={
              data.company
                .signatureImageDataUrl
            }
            alt="Authorized digital signature"
          />
        ) : null}

        <div className="bw-authorized-signature-label">
          Authorized Signatory
        </div>
      </div>

      <h2 className="bw-bank-details-heading">
        BANK DETAILS
      </h2>

      <table className="bw-bank-details-table">
        <tbody>
          {bankRows.map(
            ([
              label,
              value,
            ]) => (
              <tr key={label}>
                <th>
                  {label}
                </th>

                <td>
                  {value}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function TermsPage({
  data,
  pageNumber,
  termsPage,
  showClosingDetails,
}: {
  data: QuotationData;
  pageNumber: number;
  termsPage: TermsPageGroup;
  showClosingDetails: boolean;
}) {
  const hasSelectableTerms =
    Array.isArray(data.terms) &&
    data.terms.length > 0;

  const selectedTerms =
    hasSelectableTerms
      ? data.terms!.filter(
          (term) =>
            term.selected &&
            term.text?.trim(),
        )
      : [];

  const legacyTerms =
    data.termsAndConditions
      ?.trim() ||
    "No Terms & Conditions specified.";

  return (
    <article
      className="bw-page bw-terms-page"
      style={{
        fontFamily:
          QUOTATION_FONT,
      }}
    >
      <div
        className="bw-terms-header"
      >
        <DocumentLogo
          data={data}
        />

        <div className="bw-terms-title-block">
          <h1
            style={HEADING_STYLE}
          >
            TERMS &amp; CONDITIONS
          </h1>
        </div>
      </div>

      <div className="bw-terms-body">
        {hasSelectableTerms ? (
          selectedTerms.length > 0 ? (
            <div
              className="bw-selected-terms-list"
              style={{
                margin: 0,
                padding: 0,
              }}
            >
              {termsPage.blocks.map(
                (block) => (
                  <TermsBlockRow
                    key={
                      block.key
                    }
                    block={
                      block
                    }
                  />
                ),
              )}
            </div>
          ) : (
            <p className="bw-no-terms-message">
              No Terms &amp; Conditions selected.
            </p>
          )
        ) : (
          <p
            style={{
              whiteSpace:
                "pre-line",
            }}
          >
            {legacyTerms}
          </p>
        )}
      </div>

      {showClosingDetails ? (
        <TermsClosingDetails
          data={data}
        />
      ) : null}

      <DocumentFooter
        data={data}
        pageNumber={
          pageNumber
        }
      />
    </article>
  );
}

function TermsClosingPage({
  data,
  pageNumber,
}: {
  data: QuotationData;
  pageNumber: number;
}) {
  return (
    <article
      className="bw-page bw-terms-page"
      style={{
        fontFamily:
          QUOTATION_FONT,
      }}
    >
      <div
        className="bw-terms-header"
      >
        <DocumentLogo
          data={data}
        />
      </div>

      <TermsClosingDetails
        data={data}
      />

      <DocumentFooter
        data={data}
        pageNumber={
          pageNumber
        }
      />
    </article>
  );
}

function buildGroupedDetailPages({
  data,
  rowHeights,
  tableHeaderHeight,
  pageBudget,
  totalsHeight,
}: {
  data: QuotationData;
  rowHeights: number[];
  tableHeaderHeight: number;
  pageBudget: number;
  totalsHeight: number;
}): DetailPageGroup[] {
  const abstractItems =
    data.abstractItems.length >
    0
      ? data.abstractItems
      : [
          {
            id:
              "__default_part__",
            description:
              "Products",
            price: 0,
          },
        ];

  const pages:
    DetailPageGroup[] = [
      {
        segments: [],
      },
    ];

  const pageUsed: number[] = [
    0,
  ];

  const currentPage = () =>
    pages.length - 1;

  const startNewPage =
    () => {
      pages.push({
        segments: [],
      });

      pageUsed.push(
        0,
      );
    };

  abstractItems.forEach(
    (
      abstractItem,
      partIndex,
    ) => {
      const partId =
        abstractItem.id;

      const productIndices =
        data.products.reduce<
          number[]
        >(
          (
            indices,
            product,
            productIndex,
          ) => {
            const resolved =
              data.abstractItems.length >
              0
                ? resolveProductPartId(
                    product,
                    data,
                  )
                : partId;

            if (
              resolved ===
              partId
            ) {
              indices.push(
                productIndex,
              );
            }

            return indices;
          },
          [],
        );

      const isFinalPart =
        partIndex ===
        abstractItems.length -
          1;

      const base =
        PART_HEADER_HEIGHT +
        tableHeaderHeight;

      const finalTotalsReserve =
        isFinalPart
          ? DETAIL_GAP +
            totalsHeight
          : 0;

      if (
        productIndices.length ===
        0
      ) {
        const required =
          base +
          PART_EMPTY_ROW_HEIGHT +
          PART_SUBTOTAL_HEIGHT +
          PART_BLOCK_GAP +
          finalTotalsReserve;

        if (
          pageUsed[
            currentPage()
          ] >
            0 &&
          pageUsed[
            currentPage()
          ] +
            required >
            pageBudget
        ) {
          startNewPage();
        }

        pages[
          currentPage()
        ].segments.push({
          partId,
          partIndex,
          partDescription:
            abstractItem.description,
          productIndices: [],
          serialStart: 0,
          continued: false,
          showSubtotal: true,
          rowHeights: [],
        });

        pageUsed[
          currentPage()
        ] += required;

        return;
      }

      /*
       * First check whether this complete Part is small enough
       * to fit on one fresh detail page. If yes, treat the Part
       * as an indivisible block: either place the whole Part in
       * the remaining space, or move the whole Part to the next
       * page. This prevents cases such as a 2-row PART C being
       * split 1 + 1 while a large blank area remains.
       */
      const completeRowsHeight =
        productIndices.reduce(
          (
            total,
            productIndex,
          ) =>
            total +
            (
              rowHeights[
                productIndex
              ] || 44
            ),
          0,
        );

      const completePartHeight =
        base +
        completeRowsHeight +
        PART_SUBTOTAL_HEIGHT +
        PART_BLOCK_GAP +
        finalTotalsReserve;

      if (
        completePartHeight <=
        pageBudget
      ) {
        const current =
          currentPage();

        if (
          pageUsed[
            current
          ] >
            0 &&
          pageUsed[
            current
          ] +
            completePartHeight >
            pageBudget
        ) {
          startNewPage();
        }

        pages[
          currentPage()
        ].segments.push({
          partId,
          partIndex,
          partDescription:
            abstractItem.description,
          productIndices:
            productIndices,
          serialStart: 0,
          continued: false,
          showSubtotal: true,
          rowHeights:
            productIndices.map(
              (
                productIndex,
              ) =>
                rowHeights[
                  productIndex
                ] || 44,
            ),
        });

        pageUsed[
          currentPage()
        ] +=
          completePartHeight;

        return;
      }

      /*
       * Large Parts may genuinely need more than one page.
       * Split only those Parts, and reserve the subtotal on the
       * page containing the final row. Final quotation totals
       * are also kept together as one reserved block.
       */
      let cursor = 0;
      let continued = false;

      while (
        cursor <
        productIndices.length
      ) {
        const pageIndex =
          currentPage();

        const available =
          pageBudget -
          pageUsed[
            pageIndex
          ];

        const nextRowHeight =
          rowHeights[
            productIndices[
              cursor
            ]
          ] || 44;

        if (
          pageUsed[
            pageIndex
          ] >
            0 &&
          available <
            base +
              nextRowHeight
        ) {
          startNewPage();
          continue;
        }

        const selected:
          number[] = [];

        const selectedHeights:
          number[] = [];

        let rowsHeight = 0;

        while (
          cursor <
          productIndices.length
        ) {
          const productIndex =
            productIndices[
              cursor
            ];

          const rowHeight =
            rowHeights[
              productIndex
            ] || 44;

          const isLastRow =
            cursor ===
            productIndices.length -
              1;

          const reserve =
            isLastRow
              ? PART_SUBTOTAL_HEIGHT +
                PART_BLOCK_GAP +
                finalTotalsReserve
              : 0;

          const required =
            base +
            rowsHeight +
            rowHeight +
            reserve;

          if (
            required <=
              available ||
            (
              selected.length ===
                0 &&
              pageUsed[
                currentPage()
              ] === 0
            )
          ) {
            selected.push(
              productIndex,
            );

            selectedHeights.push(
              rowHeight,
            );

            rowsHeight +=
              rowHeight;

            cursor += 1;

            continue;
          }

          break;
        }

        if (
          selected.length ===
          0
        ) {
          startNewPage();
          continue;
        }

        const completed =
          cursor ===
          productIndices.length;

        pages[
          currentPage()
        ].segments.push({
          partId,
          partIndex,
          partDescription:
            abstractItem.description,
          productIndices:
            selected,
          serialStart:
            cursor -
            selected.length,
          continued,
          showSubtotal:
            completed,
          rowHeights:
            selectedHeights,
        });

        pageUsed[
          currentPage()
        ] +=
          base +
          rowsHeight +
          (
            completed
              ? PART_SUBTOTAL_HEIGHT +
                PART_BLOCK_GAP +
                finalTotalsReserve
              : 0
          );

        if (!completed) {
          startNewPage();
          continued = true;
        }
      }
    },
  );

  return pages.filter(
    (page) =>
      page.segments.length >
      0,
  );
}


export default function QuotationPreview({
  data,
}: {
  data: QuotationData;
}) {
  const safeProducts =
    Array.isArray(
      data.products,
    )
      ? data.products
      : [];

  const visibleColumns =
    Array.isArray(
      data.columns,
    )
      ? data.columns.filter(
          (column) =>
            column.visible &&
            column.kind !==
              "gstRate",
        )
      : [];

  const normalizedColumns =
    visibleColumns.map(
      (column) =>
        column.kind ===
        "image"
          ? {
              ...column,
              label:
                "Model Number",
            }
          : column,
    );

  const selectedTerms =
    useMemo(
      () =>
        Array.isArray(
          data.terms,
        )
          ? data.terms.filter(
              (term) =>
                term.selected &&
                term.text?.trim(),
            )
          : [],
      [
        data.terms,
      ],
    );

  const hasSelectableTerms =
    Array.isArray(data.terms) &&
    data.terms.length > 0;

  const termBlocks =
    useMemo(
      () =>
        buildTermBlocks(
          selectedTerms,
        ),
      [
        selectedTerms,
      ],
    );

  const rowRefs =
    useRef<
      Array<
        HTMLTableRowElement |
        null
      >
    >([]);

  const detailHeaderRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const tableHeadRef =
    useRef<HTMLTableSectionElement | null>(
      null,
    );

  const totalsRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const continuationRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const termsHeaderRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const termsClosingRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const termBlockRefs =
    useRef<
      Array<
        HTMLDivElement |
        null
      >
    >([]);


  const [
    measurements,
    setMeasurements,
  ] = useState({
    rowHeights:
      safeProducts.map(
        () => 44,
      ),
    detailHeaderHeight:
      120,
    tableHeaderHeight:
      34,
    totalsHeight: 96,
    continuationHeight:
      18,
  });

  const [
    termsMeasurements,
    setTermsMeasurements,
  ] = useState({
    headerHeight: 140,
    closingHeight: 330,
    blockHeights:
      termBlocks.map(
        () => 30,
      ),
  });

  useLayoutEffect(
    () => {
      const measure =
        () => {
          setMeasurements({
            rowHeights:
              safeProducts.map(
                (
                  _,
                  index,
                ) =>
                  Math.max(
                    36,
                    Math.ceil(
                      rowRefs
                        .current[
                        index
                      ]
                        ?.getBoundingClientRect()
                        .height ||
                        54,
                    ),
                  ),
              ),

            detailHeaderHeight:
              Math.ceil(
                detailHeaderRef
                  .current
                  ?.getBoundingClientRect()
                  .height ||
                  120,
              ),

            tableHeaderHeight:
              Math.ceil(
                tableHeadRef
                  .current
                  ?.getBoundingClientRect()
                  .height ||
                  34,
              ),

            totalsHeight:
              Math.ceil(
                totalsRef
                  .current
                  ?.getBoundingClientRect()
                  .height ||
                  96,
              ),

            continuationHeight:
              Math.ceil(
                continuationRef
                  .current
                  ?.getBoundingClientRect()
                  .height ||
                  18,
              ),
          });
        };

      const frame =
        requestAnimationFrame(
          measure,
        );

      const timer =
        window.setTimeout(
          measure,
          120,
        );

      return () => {
        cancelAnimationFrame(
          frame,
        );

        window.clearTimeout(
          timer,
        );
      };
    },
    [
      safeProducts,
      normalizedColumns,
    ],
  );

  useLayoutEffect(
    () => {
      const heightWithMargins =
        (
          element:
            HTMLElement |
            null,
          fallback: number,
        ) => {
          if (!element) {
            return fallback;
          }

          const rect =
            element
              .getBoundingClientRect();

          const style =
            window
              .getComputedStyle(
                element,
              );

          const marginTop =
            Number.parseFloat(
              style.marginTop,
            ) || 0;

          const marginBottom =
            Number.parseFloat(
              style.marginBottom,
            ) || 0;

          return Math.ceil(
            rect.height +
              marginTop +
              marginBottom,
          );
        };

      const measure =
        () => {
          setTermsMeasurements({
            headerHeight:
              heightWithMargins(
                termsHeaderRef
                  .current,
                140,
              ),
            closingHeight:
              heightWithMargins(
                termsClosingRef
                  .current,
                330,
              ),
            blockHeights:
              termBlocks.map(
                (
                  _,
                  index,
                ) =>
                  heightWithMargins(
                    termBlockRefs
                      .current[
                      index
                    ],
                    30,
                  ),
              ),
          });
        };

      const frame =
        requestAnimationFrame(
          measure,
        );

      const timer =
        window.setTimeout(
          measure,
          120,
        );

      return () => {
        cancelAnimationFrame(
          frame,
        );

        window.clearTimeout(
          timer,
        );
      };
    },
    [
      termBlocks,
      data.company
        .logoDataUrl,
      data.company
        .signatureImageDataUrl,
      data.company.name,
      data.company
        .footerLine1,
    ],
  );

  const detailPages =
    useMemo(
      () => {
        const pageBudget =
          DETAIL_INNER_HEIGHT -
          measurements
            .detailHeaderHeight -
          DETAIL_GAP -
          measurements
            .continuationHeight -
          DETAIL_SAFETY;

        return buildGroupedDetailPages({
          data,
          rowHeights:
            measurements
              .rowHeights,
          tableHeaderHeight:
            measurements
              .tableHeaderHeight,
          pageBudget:
            Math.max(
              120,
              pageBudget,
            ),
          totalsHeight:
            measurements
              .totalsHeight,
        });
      },
      [
        data,
        measurements,
      ],
    );

  const termsPageBudget =
    Math.max(
      180,
      TERMS_INNER_HEIGHT -
        termsMeasurements
          .headerHeight -
        TERMS_GAP -
        TERMS_SAFETY -
        TERMS_LIST_OVERHEAD,
    );

  const termsPages =
    useMemo(
      () =>
        hasSelectableTerms
          ? buildTermsPageGroups({
              blocks:
                termBlocks,
              blockHeights:
                termsMeasurements
                  .blockHeights,
              pageBudget:
                termsPageBudget,
            })
          : [
              {
                blocks: [],
                usedHeight: 0,
              },
            ],
      [
        hasSelectableTerms,
        termBlocks,
        termsMeasurements
          .blockHeights,
        termsPageBudget,
      ],
    );

  const termsPageCount =
    Math.max(
      1,
      termsPages.length,
    );

  const firstTermsPageNumber =
    2 +
    detailPages.length;

  const lastTermsPage =
    termsPages[
      termsPages.length - 1
    ];

  const separateClosingPage =
    hasSelectableTerms &&
    selectedTerms.length > 0 &&
    Boolean(
      lastTermsPage &&
        lastTermsPage
          .usedHeight +
          termsMeasurements
            .closingHeight >
          termsPageBudget,
    );

  const widths =
    getColumnWidths(
      normalizedColumns,
    );

  return (
    <div className="bw-preview-document">
      <AbstractPage
        data={data}
        pageNumber={1}
      />

      {detailPages.map(
        (
          page,
          pageIndex,
        ) => (
          <DetailPage
            key={`product-detail-${pageIndex}`}
            data={data}
            page={page}
            pageNumber={
              pageIndex + 2
            }
            pageIndex={
              pageIndex
            }
            totalDetailPages={
              detailPages.length
            }
            visibleColumns={
              normalizedColumns
            }
          />
        ),
      )}

      {termsPages.map(
        (
          termsPage,
          termsPageIndex,
        ) => (
          <TermsPage
            key={`terms-page-${termsPageIndex}`}
            data={data}
            pageNumber={
              firstTermsPageNumber +
              termsPageIndex
            }
            termsPage={
              termsPage
            }
            showClosingDetails={
              !separateClosingPage &&
              termsPageIndex ===
                termsPageCount - 1
            }
          />
        ),
      )}

      {separateClosingPage ? (
        <TermsClosingPage
          data={data}
          pageNumber={
            firstTermsPageNumber +
            termsPageCount
          }
        />
      ) : null}

      {/* Off-screen Terms measurement copy */}
      <div
        aria-hidden="true"
        className="bw-terms-page"
        style={{
          position:
            "fixed",
          left:
            "-12000px",
          top: 0,
          width: "686px",
          visibility:
            "hidden",
          pointerEvents:
            "none",
          zIndex: -1,
          fontFamily:
            QUOTATION_FONT,
        }}
      >
        <div
          ref={
            termsHeaderRef
          }
          className="bw-terms-header"
        >
          <DocumentLogo
            data={data}
          />

          <div className="bw-terms-title-block">
            <h1
              style={HEADING_STYLE}
            >
              TERMS &amp; CONDITIONS
            </h1>
          </div>
        </div>

        <div className="bw-terms-body">
          <div
            className="bw-selected-terms-list"
            style={{
              margin: 0,
              padding: 0,
            }}
          >
            {termBlocks.map(
              (
                block,
                index,
              ) => (
                <div
                  key={`measure-${block.key}`}
                  ref={(
                    element,
                  ) => {
                    termBlockRefs
                      .current[
                      index
                    ] =
                      element;
                  }}
                >
                  <TermsBlockRow
                    block={
                      block
                    }
                  />
                </div>
              ),
            )}
          </div>
        </div>

        <div
          ref={
            termsClosingRef
          }
        >
          <TermsClosingDetails
            data={data}
          />
        </div>
      </div>

      {/* Off-screen measurement copy */}
      <div
        aria-hidden="true"
        className="bw-detail-page"
        style={{
          position:
            "fixed",
          left:
            "-12000px",
          top: 0,
          width: "686px",
          visibility:
            "hidden",
          pointerEvents:
            "none",
          zIndex: -1,
        }}
      >
        <div
          ref={
            detailHeaderRef
          }
        >
          <DetailHeader
            data={data}
          />
        </div>

        <div
          ref={
            continuationRef
          }
          className="bw-detail-continuation"
        >
          Product Details — 1 of 2
        </div>

        <table className="bw-product-table">
          <colgroup>
            {normalizedColumns.map(
              (
                column,
                index,
              ) => (
                <col
                  key={
                    column.id
                  }
                  style={{
                    width:
                      widths[
                        index
                      ],
                  }}
                />
              ),
            )}
          </colgroup>

          <thead
            ref={
              tableHeadRef
            }
          >
            <tr>
              {normalizedColumns.map(
                (
                  column,
                ) => (
                  <th
                    key={
                      column.id
                    }
                  >
                    {displayColumnLabel(
                      column,
                    )}
                  </th>
                ),
              )}
            </tr>
          </thead>

          <tbody>
            {safeProducts.map(
              (
                product,
                index,
              ) => (
                <tr
                  key={
                    product.id
                  }
                  ref={(
                    element,
                  ) => {
                    rowRefs
                      .current[
                      index
                    ] =
                      element;
                  }}
                >
                  {normalizedColumns.map(
                    (
                      column,
                    ) => (
                      <td
                        key={
                          column.id
                        }
                      >
                        {getColumnValue(
                          column,
                          product,
                          index,
                        )}
                      </td>
                    ),
                  )}
                </tr>
              ),
            )}
          </tbody>
        </table>

        <div
          ref={
            totalsRef
          }
        >
          <DetailTotals
            data={data}
          />
        </div>
      </div>
    </div>
  );
}
