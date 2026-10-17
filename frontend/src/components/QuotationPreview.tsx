import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  QuotationData,
} from "../types/quotation";

import {
  generateQuotationPdf,
} from "../utils/api";


interface Props {
  data: QuotationData;
}


export default function PdfQuotationPreview({
  data,
}: Props) {
  const [
    pdfUrl,
    setPdfUrl,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");


  /*
   * Use the same cleaned payload that the Download PDF
   * action uses. This prevents blank editor rows from
   * changing the preview PDF.
   */
  const pdfData =
    useMemo<QuotationData>(
      () => ({
        ...data,

        products:
          Array.isArray(
            data.products,
          )
            ? data.products.filter(
                (product) =>
                  product.description
                    .trim(),
              )
            : [],

        abstractItems:
          Array.isArray(
            data.abstractItems,
          )
            ? data.abstractItems.filter(
                (item) =>
                  item.description
                    .trim(),
              )
            : [],
      }),
      [
        data,
      ],
    );


  useEffect(
    () => {
      let cancelled =
        false;

      let objectUrl = "";

      const loadPdf =
        async () => {
          setLoading(true);
          setError("");
          setPdfUrl("");

          try {
            const {
              blob,
            } =
              await generateQuotationPdf(
                pdfData,
              );

            if (cancelled) {
              return;
            }

            objectUrl =
              URL.createObjectURL(
                blob,
              );

            setPdfUrl(
              objectUrl,
            );
          } catch (err) {
            if (cancelled) {
              return;
            }

            setError(
              err instanceof Error
                ? err.message
                : "Unable to generate PDF preview.",
            );
          } finally {
            if (!cancelled) {
              setLoading(
                false,
              );
            }
          }
        };

      void loadPdf();

      return () => {
        cancelled = true;

        if (objectUrl) {
          URL.revokeObjectURL(
            objectUrl,
          );
        }
      };
    },
    [
      pdfData,
    ],
  );


  if (loading) {
    return (
      <div
        style={{
          minHeight:
            "calc(100vh - 96px)",
          display: "grid",
          placeItems:
            "center",
          background:
            "#e9edf2",
          color: "#475569",
          fontSize: "14px",
        }}
      >
        Generating exact PDF preview...
      </div>
    );
  }


  if (error) {
    return (
      <div
        className="global-error"
        style={{
          margin: "24px",
        }}
      >
        {error}
      </div>
    );
  }


  if (!pdfUrl) {
    return null;
  }


  return (
    <div
      style={{
        width: "100%",
        height:
          "calc(100vh - 86px)",
        minHeight: "720px",
        background:
          "#e9edf2",
      }}
    >
      <iframe
        title="Quotation PDF Preview"
        src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          border: 0,
          background:
            "#e9edf2",
        }}
      />
    </div>
  );
}
