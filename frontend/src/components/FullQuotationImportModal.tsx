import {
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import {
  importFullQuotationPdf,
  type FullQuotationExtractedData,
  type FullQuotationImportResponse,
} from "../api/fullPdfImport";


interface Props {
  open: boolean;

  onClose: () => void;

  onImport: (
    quotation:
      FullQuotationExtractedData,
  ) => void;
}


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


export default function FullQuotationImportModal({
  open,
  onClose,
  onImport,
}: Props) {
  const inputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const [
    file,
    setFile,
  ] =
    useState<File | null>(
      null,
    );

  const [
    result,
    setResult,
  ] =
    useState<FullQuotationImportResponse | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  if (!open) {
    return null;
  }

  const reset = () => {
    setFile(null);
    setResult(null);
    setError("");
    setLoading(false);

    if (
      inputRef.current
    ) {
      inputRef.current.value =
        "";
    }
  };

  const closeModal = () => {
    reset();
    onClose();
  };

  const readPdf =
    async (
      selectedFile:
        File,
    ) => {
      setLoading(
        true,
      );

      setError(
        "",
      );

      setResult(
        null,
      );

      try {
        const extracted =
          await importFullQuotationPdf(
            selectedFile,
          );

        setResult(
          extracted,
        );
      } catch (
        err
      ) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to import this quotation PDF.",
        );
      } finally {
        setLoading(
          false,
        );
      }
    };

  const selectFile =
    async (
      selectedFile:
        File | null,
    ) => {
      if (
        !selectedFile
      ) {
        return;
      }

      if (
        selectedFile.type !==
          "application/pdf" &&
        !selectedFile.name
          .toLowerCase()
          .endsWith(
            ".pdf",
          )
      ) {
        setError(
          "Please choose a PDF file.",
        );

        return;
      }

      setFile(
        selectedFile,
      );

      await readPdf(
        selectedFile,
      );
    };

  const handleFileChange = (
    event:
      ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile =
      event.target
        .files?.[0] ??
      null;

    void selectFile(
      selectedFile,
    );
  };

  const chooseAnother =
    () => {
      reset();

      window.setTimeout(
        () =>
          inputRef
            .current
            ?.click(),
        0,
      );
    };

  const importQuotation =
    () => {
      if (
        !result?.quotation
      ) {
        return;
      }

      onImport(
        result.quotation,
      );

      closeModal();
    };

  const quotation =
    result?.quotation;

  const hasQuotation =
    Boolean(
      quotation &&
      (
        quotation.quote
          ?.quoteNumber ||
        quotation.quote
          ?.projectName ||
        quotation.customer
          ?.name ||
        quotation.abstractItems
          ?.length ||
        quotation.products
          ?.length
      ),
    );

  return (
    <div
      className="pdf-import-overlay"
      role="presentation"
    >
      <div
        className="pdf-import-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Import Full Quotation PDF"
      >
        <div className="pdf-import-header">
          <div>
            <h2>
              Import Full Quotation
            </h2>

            <p>
              Upload a complete quotation PDF.
              Client, project, quotation,
              abstract, part-wise products,
              terms and bank details will be
              extracted when present.
            </p>
          </div>

          <button
            type="button"
            className="pdf-import-close"
            aria-label="Close"
            onClick={
              closeModal
            }
          >
            ×
          </button>
        </div>

        <div className="pdf-import-body">
          <input
            ref={
              inputRef
            }
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={
              handleFileChange
            }
          />

          {!file &&
          !loading ? (
            <button
              type="button"
              className="pdf-import-dropzone"
              onClick={() =>
                inputRef
                  .current
                  ?.click()
              }
            >
              <span className="pdf-import-icon">
                PDF
              </span>

              <strong>
                Choose complete quotation PDF
              </strong>

              <span>
                Import all available quotation data
              </span>

              <small>
                Works best with text-based PDFs generated by this application.
              </small>
            </button>
          ) : null}

          {loading ? (
            <div className="pdf-import-loading">
              Reading complete quotation…
            </div>
          ) : null}

          {file ? (
            <div className="pdf-selected-file">
              <span>
                Selected PDF
              </span>

              <strong>
                {file.name}
              </strong>

              <small>
                {(
                  file.size /
                  1024 /
                  1024
                ).toFixed(
                  2,
                )}{" "}
                MB
              </small>
            </div>
          ) : null}

          {result &&
          hasQuotation ? (
            <>
              <div className="pdf-import-summary">
                <div>
                  <span>
                    Client
                  </span>

                  <strong>
                    {quotation
                      ?.customer
                      ?.name ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Project
                  </span>

                  <strong>
                    {quotation
                      ?.quote
                      ?.projectName ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Quote No.
                  </span>

                  <strong>
                    {quotation
                      ?.quote
                      ?.quoteNumber ||
                      "—"}
                  </strong>
                </div>
              </div>

              <div className="pdf-import-summary">
                <div>
                  <span>
                    Abstract Parts
                  </span>

                  <strong>
                    {quotation
                      ?.abstractItems
                      ?.length ??
                      0}
                  </strong>
                </div>

                <div>
                  <span>
                    Products
                  </span>

                  <strong>
                    {quotation
                      ?.products
                      ?.length ??
                      0}
                  </strong>
                </div>

                <div>
                  <span>
                    Terms
                  </span>

                  <strong>
                    {quotation
                      ?.terms
                      ?.length ??
                      0}
                  </strong>
                </div>
              </div>

              <div className="pdf-import-table-wrap">
                <table className="pdf-import-table">
                  <tbody>
                    <tr>
                      <th>
                        Quote Date
                      </th>

                      <td>
                        {quotation
                          ?.quote
                          ?.quoteDate ||
                          "—"}
                      </td>

                      <th>
                        Site Location
                      </th>

                      <td>
                        {quotation
                          ?.quote
                          ?.siteLocation ||
                          "—"}
                      </td>
                    </tr>

                    <tr>
                      <th>
                        Subtotal
                      </th>

                      <td>
                        {money(
                          result
                            .totals
                            .subtotal,
                        )}
                      </td>

                      <th>
                        GST
                      </th>

                      <td>
                        {money(
                          result
                            .totals
                            .gstAmount,
                        )}
                      </td>
                    </tr>

                    <tr>
                      <th>
                        Grand Total
                      </th>

                      <td>
                        {money(
                          result
                            .totals
                            .grandTotal,
                        )}
                      </td>

                      <th>
                        PDF Pages
                      </th>

                      <td>
                        {result
                          .meta
                          .pageCount}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="pdf-import-warning">
                Importing the full quotation
                will replace the editable
                client, quotation, abstract,
                products and terms currently
                in the builder. Your template,
                logo and signature are kept.
              </div>
            </>
          ) : null}

          {error ? (
            <div className="pdf-import-error">
              {error}
            </div>
          ) : null}

          {result?.warnings
            ?.length ? (
            <div className="pdf-import-warning">
              {result.warnings.map(
                (
                  warning,
                ) => (
                  <div
                    key={
                      warning
                    }
                  >
                    {
                      warning
                    }
                  </div>
                ),
              )}
            </div>
          ) : null}

          <div
            className={`pdf-import-actions${
              hasQuotation
                ? " pdf-import-actions--review"
                : ""
            }`}
          >
            {file ? (
              <button
                type="button"
                className="secondary-button"
                disabled={
                  loading
                }
                onClick={
                  chooseAnother
                }
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
                onClick={
                  closeModal
                }
              >
                Cancel
              </button>

              {hasQuotation ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    importQuotation
                  }
                >
                  Import Full Quotation
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
