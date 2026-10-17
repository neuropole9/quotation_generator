import type {
  ProductLine,
  QuotationAbstractLine,
  QuotationData,
  QuotationTerm,
} from "../types/quotation";

import {
  apiUrl,
} from "../utils/apiBase";


export interface FullQuotationImportMeta {
  pageCount: number;
  tablesFound: number;
  productTablesFound: number;
  pagesWithText: number;
  abstractCount: number;
  termCount: number;
}


export interface FullQuotationImportTotals {
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  grandTotal: number;
}


export interface FullQuotationExtractedData {
  company: Partial<
    QuotationData["company"]
  >;

  customer: Partial<
    QuotationData["customer"]
  >;

  quote: Partial<
    QuotationData["quote"]
  >;

  abstractItems:
    QuotationAbstractLine[];

  products:
    ProductLine[];

  notes: string;

  terms:
    QuotationTerm[];

  termsAndConditions: string;
}


export interface FullQuotationImportResponse {
  success: boolean;

  quotation:
    FullQuotationExtractedData;

  totals:
    FullQuotationImportTotals;

  warnings: string[];

  meta:
    FullQuotationImportMeta;
}


const normalizeAbstractItem = (
  item: any,
  index: number,
): QuotationAbstractLine => ({
  id:
    String(
      item?.id ||
      `import-part-${index + 1}`,
    ),

  description:
    String(
      item?.description ||
      "",
    ).trim(),

  price:
    Number(
      item?.price ||
      0,
    ) || 0,
});


const normalizeProduct = (
  product: any,
  index: number,
): ProductLine => ({
  id:
    String(
      product?.id ||
      `import-product-${index + 1}`,
    ),

  modelNumber:
    String(
      product?.modelNumber ||
      product?.model_number ||
      "",
    ).trim(),

  imageDataUrl: "",

  abstractItemId:
    String(
      product?.abstractItemId ||
      "",
    ).trim(),

  description:
    String(
      product?.description ||
      "",
    ).trim(),

  unit:
    String(
      product?.unit ||
      "Nos",
    ).trim() ||
    "Nos",

  quantity:
    Number(
      product?.quantity ??
      1,
    ) || 1,

  unitPrice:
    Number(
      product?.unitPrice ??
      product?.unit_price ??
      0,
    ) || 0,

  gstRate:
    Number(
      product?.gstRate ??
      18,
    ) || 0,

  customValues:
    product?.customValues &&
    typeof product.customValues ===
      "object"
      ? product.customValues
      : {},
});


const normalizeTerm = (
  term: any,
  index: number,
): QuotationTerm => ({
  id:
    String(
      term?.id ||
      `import-term-${index + 1}`,
    ),

  text:
    String(
      term?.text ||
      "",
    ).trim(),

  selected:
    term?.selected !== false,

  isCustom:
    term?.isCustom !== false,
});


export async function importFullQuotationPdf(
  file: File,
): Promise<FullQuotationImportResponse> {
  const formData =
    new FormData();

  formData.append(
    "file",
    file,
  );

  const response =
    await fetch(
      apiUrl(
        "/api/quotation/import-full-pdf",
      ),
      {
        method: "POST",
        body: formData,
      },
    );

  if (!response.ok) {
    let message =
      `Full quotation import failed (${response.status}).`;

    try {
      const body =
        await response.json();

      message =
        body?.detail ||
        body?.message ||
        message;
    } catch {
      // Keep fallback message.
    }

    throw new Error(
      message,
    );
  }

  const payload =
    await response.json();

  const quotation =
    payload?.quotation || {};

  const abstractItems =
    Array.isArray(
      quotation.abstractItems,
    )
      ? quotation.abstractItems.map(
          normalizeAbstractItem,
        )
      : [];

  const products =
    Array.isArray(
      quotation.products,
    )
      ? quotation.products.map(
          normalizeProduct,
        )
      : [];

  const terms =
    Array.isArray(
      quotation.terms,
    )
      ? quotation.terms.map(
          normalizeTerm,
        )
      : [];

  return {
    success:
      payload?.success !== false,

    quotation: {
      company:
        quotation.company &&
        typeof quotation.company ===
          "object"
          ? quotation.company
          : {},

      customer:
        quotation.customer &&
        typeof quotation.customer ===
          "object"
          ? quotation.customer
          : {},

      quote:
        quotation.quote &&
        typeof quotation.quote ===
          "object"
          ? quotation.quote
          : {},

      abstractItems,

      products,

      notes:
        String(
          quotation.notes ||
          "",
        ),

      terms,

      termsAndConditions:
        String(
          quotation.termsAndConditions ||
          "",
        ),
    },

    totals: {
      subtotal:
        Number(
          payload?.totals
            ?.subtotal ??
            0,
        ) || 0,

      gstRate:
        Number(
          payload?.totals
            ?.gstRate ??
            0,
        ) || 0,

      gstAmount:
        Number(
          payload?.totals
            ?.gstAmount ??
            0,
        ) || 0,

      grandTotal:
        Number(
          payload?.totals
            ?.grandTotal ??
            0,
        ) || 0,
    },

    warnings:
      Array.isArray(
        payload?.warnings,
      )
        ? payload.warnings
            .map(
              (
                warning:
                  unknown,
              ) =>
                String(
                  warning ??
                  "",
                ).trim(),
            )
            .filter(Boolean)
        : [],

    meta: {
      pageCount:
        Number(
          payload?.meta
            ?.pageCount ??
            0,
        ) || 0,

      tablesFound:
        Number(
          payload?.meta
            ?.tablesFound ??
            0,
        ) || 0,

      productTablesFound:
        Number(
          payload?.meta
            ?.productTablesFound ??
            0,
        ) || 0,

      pagesWithText:
        Number(
          payload?.meta
            ?.pagesWithText ??
            0,
        ) || 0,

      abstractCount:
        Number(
          payload?.meta
            ?.abstractCount ??
            abstractItems.length,
        ) ||
        abstractItems.length,

      termCount:
        Number(
          payload?.meta
            ?.termCount ??
            terms.length,
        ) ||
        terms.length,
    },
  };
}
