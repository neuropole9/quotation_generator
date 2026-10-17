import type {
  QuotationData,
} from "../types/quotation";

import {
  apiUrl,
} from "./apiBase";


/* =========================================================
   PDF
========================================================= */

export interface GeneratedQuotationPdf {
  blob: Blob;
  fileName: string;
}


export async function generateQuotationPdf(
  data: QuotationData,
): Promise<GeneratedQuotationPdf> {
  const response =
    await fetch(
      apiUrl(
        "/api/quotation/pdf",
      ),
      {
        method:
          "POST",

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
    const message =
      await readApiError(
        response,
        "Unable to generate PDF.",
      );

    throw new Error(
      message,
    );
  }


  const blob =
    await response.blob();


  const disposition =
    response.headers.get(
      "content-disposition",
    ) || "";


  const utfFileNameMatch =
    disposition.match(
      /filename\*=UTF-8''([^;]+)/i,
    );


  const normalFileNameMatch =
    disposition.match(
      /filename="?([^";]+)"?/i,
    );


  let fileName =
    `${
      data.quote
        .quoteNumber ||
      "quotation"
    }.pdf`;


  if (
    utfFileNameMatch?.[1]
  ) {
    try {
      fileName =
        decodeURIComponent(
          utfFileNameMatch[
            1
          ],
        );
    } catch {
      fileName =
        utfFileNameMatch[
          1
        ];
    }
  } else if (
    normalFileNameMatch?.[1]
  ) {
    fileName =
      normalFileNameMatch[
        1
      ];
  }


  return {
    blob,
    fileName,
  };
}


export async function downloadQuotationPdf(
  data: QuotationData,
): Promise<void> {
  const {
    blob,
    fileName,
  } =
    await generateQuotationPdf(
      data,
    );


  const url =
    URL.createObjectURL(
      blob,
    );


  try {
    const anchor =
      document.createElement(
        "a",
      );

    anchor.href =
      url;

    anchor.download =
      fileName;

    document.body.appendChild(
      anchor,
    );

    anchor.click();

    anchor.remove();
  } finally {
    URL.revokeObjectURL(
      url,
    );
  }
}


/* =========================================================
   SAVED QUOTATIONS
========================================================= */

export type QuotationSaveStatus =
  | "DRAFT"
  | "SAVED";


export interface QuotationSummary {
  id: number;
  status:
    QuotationSaveStatus;
  quoteNumber: string;
  customerName: string;
  customerCompany: string;
  projectName: string;
  quoteDate: string;
  ownerUserId:
    | string
    | null;
  createdByName:
    | string
    | null;
  createdByEmail:
    | string
    | null;
  createdAt: string;
  updatedAt: string;
}


export interface SavedQuotation
  extends QuotationSummary {
  data: QuotationData;
}


export interface QuotationListResponse {
  items:
    QuotationSummary[];
  total: number;
}


export interface SaveQuotationOptions {
  status:
    QuotationSaveStatus;
  data:
    QuotationData;
}


export interface ListQuotationsOptions {
  q?: string;
  status?:
    QuotationSaveStatus;
  limit?: number;
}


/* =========================================================
   AUTHENTICATED QUOTATION REQUESTS
========================================================= */

export type ClerkSessionToken =
  | string
  | null
  | undefined;


function authenticatedJsonHeaders(
  token:
    ClerkSessionToken,
): HeadersInit {
  const cleanToken =
    token?.trim();


  if (!cleanToken) {
    throw new Error(
      "Authentication required. Please sign in again.",
    );
  }


  return {
    "Content-Type":
      "application/json",

    Authorization:
      `Bearer ${cleanToken}`,
  };
}


function authenticatedHeaders(
  token:
    ClerkSessionToken,
): HeadersInit {
  const cleanToken =
    token?.trim();


  if (!cleanToken) {
    throw new Error(
      "Authentication required. Please sign in again.",
    );
  }


  return {
    Authorization:
      `Bearer ${cleanToken}`,
  };
}


/* =========================================================
   CREATE
========================================================= */

export async function createQuotation(
  options:
    SaveQuotationOptions,
  token?:
    ClerkSessionToken,
): Promise<SavedQuotation> {
  const response =
    await fetch(
      apiUrl(
        "/api/quotations",
      ),
      {
        method:
          "POST",

        headers:
          authenticatedJsonHeaders(
            token,
          ),

        body:
          JSON.stringify({
            status:
              options.status,

            data:
              options.data,
          }),
      },
    );


  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        "Unable to save quotation.",
      ),
    );
  }


  return (
    await response.json()
  ) as SavedQuotation;
}


/* =========================================================
   LIST
========================================================= */

export async function listQuotations(
  options:
    ListQuotationsOptions =
      {},
  token?:
    ClerkSessionToken,
): Promise<QuotationListResponse> {
  const params =
    new URLSearchParams();


  const search =
    options.q?.trim();

  if (search) {
    params.set(
      "q",
      search,
    );
  }


  if (
    options.status
  ) {
    params.set(
      "status",
      options.status,
    );
  }


  if (
    typeof options.limit ===
    "number"
  ) {
    params.set(
      "limit",
      String(
        options.limit,
      ),
    );
  }


  const query =
    params.toString();


  const response =
    await fetch(
      apiUrl(
        query
          ? `/api/quotations?${query}`
          : "/api/quotations",
      ),
      {
        headers:
          authenticatedHeaders(
            token,
          ),
      },
    );


  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        "Unable to load quotations.",
      ),
    );
  }


  return (
    await response.json()
  ) as QuotationListResponse;
}


/* =========================================================
   GET ONE
========================================================= */

export async function getQuotation(
  quotationId: number,
  token?:
    ClerkSessionToken,
): Promise<SavedQuotation> {
  const response =
    await fetch(
      apiUrl(
        `/api/quotations/${quotationId}`,
      ),
      {
        headers:
          authenticatedHeaders(
            token,
          ),
      },
    );


  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        "Unable to load quotation.",
      ),
    );
  }


  return (
    await response.json()
  ) as SavedQuotation;
}


/* =========================================================
   UPDATE
========================================================= */

export async function updateQuotation(
  quotationId: number,
  options:
    SaveQuotationOptions,
  token?:
    ClerkSessionToken,
): Promise<SavedQuotation> {
  const response =
    await fetch(
      apiUrl(
        `/api/quotations/${quotationId}`,
      ),
      {
        method:
          "PUT",

        headers:
          authenticatedJsonHeaders(
            token,
          ),

        body:
          JSON.stringify({
            status:
              options.status,

            data:
              options.data,
          }),
      },
    );


  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        "Unable to update quotation.",
      ),
    );
  }


  return (
    await response.json()
  ) as SavedQuotation;
}


/* =========================================================
   DELETE
========================================================= */

export async function deleteQuotation(
  quotationId: number,
  token?:
    ClerkSessionToken,
): Promise<void> {
  const response =
    await fetch(
      apiUrl(
        `/api/quotations/${quotationId}`,
      ),
      {
        method:
          "DELETE",

        headers:
          authenticatedHeaders(
            token,
          ),
      },
    );


  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        "Unable to delete quotation.",
      ),
    );
  }
}


/* =========================================================
   ERROR HANDLING
========================================================= */

async function readApiError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload =
      await response.json();


    if (
      payload &&
      typeof payload ===
        "object" &&
      "detail" in payload
    ) {
      const detail =
        (
          payload as {
            detail?:
              unknown;
          }
        ).detail;


      if (
        Array.isArray(
          detail,
        )
      ) {
        const messages =
          detail
            .map(
              (
                item,
              ) => {
                if (
                  typeof item ===
                  "string"
                ) {
                  return item;
                }


                if (
                  item &&
                  typeof item ===
                    "object" &&
                  "msg" in item
                ) {
                  return String(
                    (
                      item as {
                        msg?:
                          unknown;
                      }
                    ).msg ??
                      "",
                  );
                }


                return String(
                  item,
                );
              },
            )
            .filter(Boolean);


        if (
          messages.length >
          0
        ) {
          return messages.join(
            "\n",
          );
        }
      }


      if (
        typeof detail ===
        "string"
      ) {
        return detail;
      }


      if (
        detail != null
      ) {
        return JSON.stringify(
          detail,
        );
      }
    }
  } catch {
    try {
      const message =
        await response.text();

      if (
        message.trim()
      ) {
        return message;
      }
    } catch {
      // Ignore secondary parsing failure.
    }
  }


  return fallback;
}
