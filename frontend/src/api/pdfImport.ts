export interface ImportedPdfProduct {
  modelNumber: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

/*
 * Backward-compatible aliases.
 * Keep these because older parts of the frontend may still import
 * ImportedProduct or PdfImportProduct.
 */
export type ImportedProduct =
  ImportedPdfProduct;

export type PdfImportProduct =
  ImportedPdfProduct;

export interface PdfImportMeta {
  pageCount: number;
  tablesFound: number;
  productTablesFound?: number;
  pagesWithText: number;
}

export interface PdfImportResponse {
  success: boolean;
  productCount: number;
  products: ImportedPdfProduct[];
  warnings: string[];
  meta: PdfImportMeta;
}

const normalizeProduct = (
  product: any,
): ImportedPdfProduct => ({
  modelNumber: String(
    product?.modelNumber ??
      product?.model_number ??
      product?.model ??
      "",
  ).trim(),

  description: String(
    product?.description ??
      product?.name ??
      "",
  ).trim(),

  unit:
    String(
      product?.unit ??
        "Nos",
    ).trim() ||
    "Nos",

  quantity:
    Number(
      product?.quantity ??
        product?.qty ??
        1,
    ) ||
    1,

  unitPrice:
    Number(
      product?.unitPrice ??
        product?.unit_price ??
        product?.price ??
        product?.rate ??
        0,
    ) ||
    0,
});

export async function importQuotationPdf(
  file: File,
): Promise<PdfImportResponse> {
  const formData =
    new FormData();

  formData.append(
    "file",
    file,
  );

  const response =
    await fetch(
      "/api/quotation/import-pdf",
      {
        method: "POST",
        body: formData,
      },
    );

  if (!response.ok) {
    let message =
      `PDF import failed (${response.status}).`;

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

  const products:
    ImportedPdfProduct[] =
      Array.isArray(
        payload?.products,
      )
        ? payload.products.map(
            normalizeProduct,
          )
        : [];

  const warnings =
    Array.isArray(
      payload?.warnings,
    )
      ? payload.warnings
          .map(
            (warning: unknown) =>
              String(
                warning ?? "",
              ).trim(),
          )
          .filter(Boolean)
      : [];

  return {
    success:
      payload?.success !==
      false,

    productCount:
      Number(
        payload?.productCount ??
          products.length,
      ) ||
      products.length,

    products,

    warnings,

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
    },
  };
}
