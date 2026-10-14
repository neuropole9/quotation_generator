import {
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import type {
  ProductLine,
  QuotationColumn,
} from "../types/quotation";

import {
  importQuotationPdf,
  type ImportedPdfProduct,
  type PdfImportMeta,
} from "../api/pdfImport";

type ImportMode =
  | "replace"
  | "append";

interface Props {
  open: boolean;
  columns: QuotationColumn[];
  onClose: () => void;
  onImport: (
    products: ProductLine[],
    mode: ImportMode,
  ) => void;
}

const money = (
  value: number,
) =>
  Number(value || 0).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  );

const normalizeColumnLabel = (
  value: string,
) =>
  String(
    value ?? "",
  )
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[\s._:/\\-]+/g, "");

const importedNumber = (
  value: string | number,
) => {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  const cleaned =
    String(
      value ?? "",
    )
      .replace(/,/g, "")
      .replace(
        /[^0-9.\-]/g,
        "",
      );

  if (
    !cleaned ||
    cleaned === "-" ||
    cleaned === "." ||
    cleaned === "-."
  ) {
    return 0;
  }

  const parsed =
    Number(cleaned);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
};

const buildCustomValues = (
  product: ImportedPdfProduct,
  columns: QuotationColumn[],
): Record<string, string | number> => {
  const importedByHeader =
    new Map<
      string,
      string | number
    >();

  for (
    const [
      header,
      value,
    ] of Object.entries(
      product.extraValues ?? {},
    )
  ) {
    const normalized =
      normalizeColumnLabel(
        header,
      );

    if (normalized) {
      importedByHeader.set(
        normalized,
        value,
      );
    }
  }

  const customValues:
    Record<
      string,
      string | number
    > = {};

  for (const column of columns) {
    if (
      !column.kind.startsWith(
        "custom",
      )
    ) {
      continue;
    }

    const importedValue =
      importedByHeader.get(
        normalizeColumnLabel(
          column.label,
        ),
      );

    if (
      importedValue ===
      undefined
    ) {
      continue;
    }

    customValues[column.id] =
      column.kind ===
        "customNumber" ||
      column.kind ===
        "customCurrency"
        ? importedNumber(
            importedValue,
          )
        : String(
            importedValue ?? "",
          ).trim();
  }

  return customValues;
};

const toProductLine = (
  product: ImportedPdfProduct,
  columns: QuotationColumn[],
): ProductLine => ({
  id: crypto.randomUUID(),
  modelNumber:
    String(
      product.modelNumber || "",
    ).trim(),
  imageDataUrl: "",
  description:
    String(
      product.description || "",
    ).trim(),
  unit:
    String(
      product.unit || "Nos",
    ).trim() || "Nos",
  quantity:
    Number(
      product.quantity || 1,
    ) || 1,
  unitPrice:
    Number(
      product.unitPrice || 0,
    ) || 0,
  gstRate: 18,
  customValues:
    buildCustomValues(
      product,
      columns,
    ),
});

const isFalseNoProductsWarning = (
  message: string,
  productCount: number,
) => {
  if (productCount <= 0) {
    return false;
  }

  return /no\s+product\s+rows?\s+(?:were\s+)?found/i.test(
    message,
  );
};

export default function PdfImportModal({
  open,
  columns,
  onClose,
  onImport,
}: Props) {
  const inputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [file, setFile] =
    useState<File | null>(null);

  const [products, setProducts] =
    useState<ImportedPdfProduct[]>([]);

  const [meta, setMeta] =
    useState<PdfImportMeta | null>(
      null,
    );

  const [warnings, setWarnings] =
    useState<string[]>([]);

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [mode, setMode] =
    useState<ImportMode>("replace");

  if (!open) {
    return null;
  }

  const resetResult = () => {
    setProducts([]);
    setMeta(null);
    setWarnings([]);
    setError("");
  };

  const closeModal = () => {
    setFile(null);
    resetResult();
    setMode("replace");
    onClose();
  };

  const readPdf = async (
    selectedFile: File,
  ) => {
    /*
     * IMPORTANT:
     * Clear every previous error/warning before starting a new PDF.
     * This prevents an old "No product rows were found" message from
     * remaining visible after a later PDF successfully returns products.
     */
    setLoading(true);
    setError("");
    setWarnings([]);
    setProducts([]);
    setMeta(null);

    try {
      const result =
        await importQuotationPdf(
          selectedFile,
        );

      const nextProducts =
        Array.isArray(result.products)
          ? result.products
          : [];

      setProducts(nextProducts);
      setMeta(result.meta ?? null);

      const nextWarnings =
        Array.isArray(result.warnings)
          ? result.warnings
              .map((warning) =>
                String(warning || "").trim(),
              )
              .filter(Boolean)
              .filter(
                (warning) =>
                  !isFalseNoProductsWarning(
                    warning,
                    nextProducts.length,
                  ),
              )
          : [];

      setWarnings(nextWarnings);

      if (nextProducts.length === 0) {
        setError(
          "No product rows were found in this PDF.",
        );
      } else {
        /*
         * A successful result must always clear the error state.
         */
        setError("");
      }
    } catch (err) {
      setProducts([]);
      setMeta(null);
      setWarnings([]);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to import this PDF.",
      );
    } finally {
      setLoading(false);
    }
  };

  const selectFile = async (
    selectedFile: File | null,
  ) => {
    if (!selectedFile) {
      return;
    }

    if (
      selectedFile.type !==
        "application/pdf" &&
      !selectedFile.name
        .toLowerCase()
        .endsWith(".pdf")
    ) {
      resetResult();
      setFile(null);
      setError(
        "Please choose a PDF file.",
      );
      return;
    }

    setFile(selectedFile);
    await readPdf(selectedFile);
  };

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile =
      event.target.files?.[0] ??
      null;

    void selectFile(
      selectedFile,
    );
  };

  const chooseAnother = () => {
    setFile(null);
    resetResult();

    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.click();
    }
  };

  const importProducts = () => {
    if (products.length === 0) {
      return;
    }

    onImport(
      products.map(
        (product) =>
          toProductLine(
            product,
            columns,
          ),
      ),
      mode,
    );

    closeModal();
  };

  const hasProducts =
    products.length > 0;

  return (
    <div
      className="pdf-import-overlay"
      role="presentation"
    >
      <div
        className="pdf-import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Import Products from PDF"
      >
        <div className="pdf-import-header">
          <div>
            <h2>
              Import Products from PDF
            </h2>

            <p>
              Upload a BOQ or quotation PDF.
              Model number, product description,
              quantity, unit and price will be
              extracted when available. Extra PDF
              columns are imported automatically
              when their header matches a custom
              frontend column.
            </p>
          </div>

          <button
            type="button"
            className="pdf-import-close"
            aria-label="Close"
            onClick={closeModal}
          >
            ×
          </button>
        </div>

        <div className="pdf-import-body">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={handleFileChange}
          />

          {!file && !loading ? (
            <button
              type="button"
              className="pdf-import-dropzone"
              onClick={() =>
                inputRef.current?.click()
              }
            >
              <span className="pdf-import-icon">
                PDF
              </span>

              <strong>
                Choose a quotation or BOQ PDF
              </strong>

              <span>
                Click to select a PDF from your computer
              </span>

              <small>
                Text-based PDFs give the best import result.
              </small>
            </button>
          ) : null}

          {loading ? (
            <div className="pdf-import-loading">
              Reading PDF and extracting products…
            </div>
          ) : null}

          {file ? (
            <div className="pdf-selected-file">
              <span>Selected PDF</span>
              <strong>{file.name}</strong>
              <small>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </small>
            </div>
          ) : null}

          {hasProducts ? (
            <>
              <div className="pdf-import-summary">
                <div>
                  <span>Products Found</span>
                  <strong>{products.length}</strong>
                </div>

                <div>
                  <span>PDF Pages</span>
                  <strong>
                    {meta?.pageCount ?? 0}
                  </strong>
                </div>

                <div>
                  <span>Tables Found</span>
                  <strong>
                    {meta?.tablesFound ?? 0}
                  </strong>
                </div>
              </div>

              {meta?.extraHeaders?.length ? (
                <div className="pdf-import-warning">
                  Extra PDF columns detected:{" "}
                  {meta.extraHeaders.join(", ")}.
                  Matching custom frontend columns
                  will be populated automatically.
                </div>
              ) : null}

              <div className="pdf-import-table-wrap">
                <table className="pdf-import-table pdf-import-table--model">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Model Number</th>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Price</th>
                    </tr>
                  </thead>

                  <tbody>
                    {products.map(
                      (product, index) => (
                        <tr
                          key={`${product.modelNumber}-${product.description}-${index}`}
                        >
                          <td>{index + 1}</td>

                          <td>
                            {product.modelNumber || "—"}
                          </td>

                          <td>
                            {product.description || "—"}
                          </td>

                          <td>
                            {Number(
                              product.quantity || 0,
                            ).toLocaleString("en-IN")}
                          </td>

                          <td>
                            {product.unit || "—"}
                          </td>

                          <td>
                            {product.unitPrice
                              ? money(product.unitPrice)
                              : "—"}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pdf-import-mode">
                <strong>
                  Import products
                </strong>

                <label>
                  <input
                    type="radio"
                    name="pdf-import-mode"
                    checked={mode === "replace"}
                    onChange={() =>
                      setMode("replace")
                    }
                  />
                  Replace existing products
                </label>

                <label>
                  <input
                    type="radio"
                    name="pdf-import-mode"
                    checked={mode === "append"}
                    onChange={() =>
                      setMode("append")
                    }
                  />
                  Add to existing products
                </label>
              </div>
            </>
          ) : null}

          {/*
           * Never display "No product rows" when products are already
           * present. This is the exact stale-message bug shown in the
           * screenshot.
           */}
          {error && !hasProducts ? (
            <div className="pdf-import-error">
              {error}
            </div>
          ) : null}

          {warnings.length > 0 ? (
            <div className="pdf-import-warning">
              {warnings.map((warning) => (
                <div key={warning}>
                  {warning}
                </div>
              ))}
            </div>
          ) : null}

          <div
            className={`pdf-import-actions${
              hasProducts
                ? " pdf-import-actions--review"
                : ""
            }`}
          >
            {file ? (
              <button
                type="button"
                className="secondary-button"
                disabled={loading}
                onClick={chooseAnother}
              >
                Choose Another PDF
              </button>
            ) : (
              <span />
            )}

            <div className="pdf-import-action-right">
              <button
                type="button"
                className="secondary-button"
                onClick={closeModal}
              >
                Cancel
              </button>

              {hasProducts ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={importProducts}
                >
                  Import {products.length} Products
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
