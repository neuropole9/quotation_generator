import {
  useEffect,
  useState,
} from "react";

import type {
  QuotationData,
} from "../types/quotation";

import {
  apiUrl,
} from "../utils/apiBase";


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


  useEffect(
    () => {
      let cancelled = false;
      let objectUrl = "";

      const loadPdf = async () => {
        setLoading(true);
        setError("");
        setPdfUrl("");

        try {
          const response =
            await fetch(
              apiUrl(
                "/api/quotation/pdf",
              ),
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body:
                  JSON.stringify(
                    data,
                  ),
              },
            );

          if (!response.ok) {
            let message =
              "Unable to generate quotation PDF preview.";

            try {
              const payload =
                await response.json();

              if (
                payload &&
                typeof payload ===
                  "object" &&
                "detail" in payload
              ) {
                message = String(
                  (
                    payload as {
                      detail?: unknown;
                    }
                  ).detail ??
                    message,
                );
              }
            } catch {
              // Keep fallback message.
            }

            throw new Error(
              message,
            );
          }

          const blob =
            await response.blob();

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
              : "Unable to generate quotation PDF preview.",
          );
        } finally {
          if (!cancelled) {
            setLoading(false);
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
      data,
    ],
  );


  if (loading) {
    return (
      <div
        style={{
          minHeight:
            "calc(100vh - 86px)",
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
        src={`${pdfUrl}#toolbar=0&navpanes=0&view=Fit`}
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
