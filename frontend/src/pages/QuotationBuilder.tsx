import "../styles/QuoteDeskPages.css";
import {
  useAuth,
} from "@clerk/react";


import {

  useMemo,

  useEffect,

  useState,

  type ChangeEvent,

} from "react";



import PdfImportModal from "../components/PdfImportModal";

import FullQuotationImportModal from "../components/FullQuotationImportModal";
import type { FullQuotationExtractedData } from "../api/fullPdfImport";

import ProductEditor from "../components/ProductEditor";

import PdfQuotationPreview from "../components/QuotationPreview";

import TermsEditor from "../components/TermsEditor";

import { apiUrl } from "../utils/apiBase";
import {
  createQuotation,
  deleteQuotation,
  getQuotation,
  listQuotations,
  updateQuotation,
  type QuotationSaveStatus,
  type QuotationSummary,
} from "../utils/api";



import type {
  ProductLine,
  QuotationAbstractLine,
  QuotationColumn,
  QuotationData,
  QuotationTerm,
  QuotationTheme,
} from "../types/quotation";



import type {

  TemplateId,

} from "../types/template";

import {
  createDefaultTerms,
} from "../constants/defaultTerms";





interface Props {

  selectedTemplate: TemplateId;



  onTemplateChange: (

    id: TemplateId,

  ) => void;



  onBack: () => void;

  isAdmin?: boolean;
  hideSavedQuotationsButton?: boolean;

  startInSavedQuotations?: boolean;

}


type EditorPage =

  | "first"

  | "products"

  | "terms";





/* =========================================================

   DATE HELPERS

========================================================= */



const formatDateInput = (

  date: Date,

) => {

  const year =

    date.getFullYear();



  const month = String(

    date.getMonth() + 1,

  ).padStart(

    2,

    "0",

  );



  const day = String(

    date.getDate(),

  ).padStart(

    2,

    "0",

  );



  return `${year}-${month}-${day}`;

};





const today =

  formatDateInput(

    new Date(),

  );





const getFutureDate = (

  days: number,

) => {

  const date =

    new Date();



  date.setDate(

    date.getDate() +

      days,

  );



  return formatDateInput(

    date,

  );

};





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



/* =========================================================

   DEFAULT COLUMNS

========================================================= */



const DEFAULT_COLUMNS:

  QuotationColumn[] = [

    {

      id: "serial",

      label: "S.No",

      kind: "serial",

      visible: true,

    },



    {

      id: "image",

      label: "Image",

      kind: "image",

      visible: true,

    },



    {

      id: "description",

      label: "Description",

      kind: "description",

      visible: true,

    },



    {

      id: "unit",

      label: "Unit",

      kind: "unit",

      visible: true,

    },



    {

      id: "quantity",

      label: "Qty",

      kind: "quantity",

      visible: true,

    },



    {

      id: "unitPrice",

      label: "Rate",

      kind: "unitPrice",

      visible: true,

    },



    {

      id: "gstRate",

      label: "GST",

      kind: "gstRate",

      visible: true,

    },



    {

      id: "amount",

      label: "Amount",

      kind: "amount",

      visible: true,

    },

  ];





/* =========================================================

   TEMPLATE THEMES



   Quotation itself is black / white.

========================================================= */



const TEMPLATE_THEMES:

  Record<

    TemplateId,

    QuotationTheme

  > = {

    classic: {

      primaryColor:

        "#111111",



      secondaryColor:

        "#f5f5f5",

    },



    corporate: {

      primaryColor:

        "#111111",



      secondaryColor:

        "#f5f5f5",

    },



    modern: {

      primaryColor:

        "#111111",



      secondaryColor:

        "#f5f5f5",

    },



    compact: {

      primaryColor:

        "#111111",



      secondaryColor:

        "#f5f5f5",

    },

  };





/* =========================================================
   SELECTABLE TERMS
========================================================= */

const termsToLegacyText = (
  terms: QuotationTerm[],
) =>
  terms
    .filter(
      (term) =>
        term.selected &&
        term.text.trim(),
    )
    .map(
      (term, index) =>
        `${index + 1}. ${term.text.trim()}`,
    )
    .join("\n\n");


/* =========================================================

   SAMPLE DATA

========================================================= */



/* =========================================================

   EMPTY DATA

========================================================= */



const FIXED_COMPANY_NAME = "ALPHANUMERIC INNOVATIONS PRIVATE LIMITED";
const FIXED_COMPANY_ADDRESS =
  "320, East Avenue, Fifth Floor, Ayyappa Society Main Rd, near YSR Statue, Madhapur, Hyderabad, Telangana 500081";
const FIXED_COMPANY_EMAIL = "alphanumericinnovations@gmail.com";
const FIXED_COMPANY_WEBSITE = "www.aniplgroup.com";
const FIXED_FOOTER_LINE_2 =
  `${FIXED_COMPANY_ADDRESS} | ${FIXED_COMPANY_WEBSITE} | ${FIXED_COMPANY_EMAIL}`;

const createEmptyData = (

  templateId: TemplateId,

): QuotationData => ({

  templateId,



  theme:

    TEMPLATE_THEMES[

      templateId

    ],



  columns:

    DEFAULT_COLUMNS.map(

      (column) => ({

        ...column,

      }),

    ),



  company: {

    name:

      FIXED_COMPANY_NAME,



    address: FIXED_COMPANY_ADDRESS,



    phone: "",



    email:

      FIXED_COMPANY_EMAIL,



    gstNo: "",



    website:

      FIXED_COMPANY_WEBSITE,



    logoDataUrl: "",



    footerLine1:

      FIXED_COMPANY_NAME,



    footerLine2: FIXED_FOOTER_LINE_2,

    signatureImageDataUrl: "",

    accountName: "ALPHANUMERIC INNOVATIONS PVT LTD",

    accountDetails: "50200123600412",

    ifscCode: "HDFC0009607",

    bankName: "Hitech City-3",

  },



  customer: {

    name: "",



    company: "",



    address: "",



    phone: "",



    email: "",



    gstNo: "",

  },



  quote: {

    quoteNumber: "",



    quoteDate:

      today,



    validUntil:

      getFutureDate(

        30,

      ),



    reference: "",



    siteLocation: "",



    projectName: "",



    mepDetails: "",



    quoteDetails: "",

  },



  project: {

    panel: "",



    projectType: "",



    cabinet: "",



    module: "",



    screenSize: "",



    moduleSize: "",



    height: "",



    width: "",



    quantity: "",



    moduleDot: "",

  },



  abstractItems: [

    {

      id:

        crypto.randomUUID(),



      description: "",



      price: 0,

    },

  ],



  products: [

    {

      id:

        crypto.randomUUID(),



      imageDataUrl: "",



      description: "",



      unit:

        "Nos",



      quantity:

        1,



      unitPrice:

        0,



      gstRate:

        18,



      customValues: {},

    },

  ],



  notes: "",



  terms:
    createDefaultTerms(),

  // Clear All restores the standard 9 selectable terms.
  termsAndConditions:
    termsToLegacyText(
      createDefaultTerms(),
    ),

});





/* =========================================================

   PDF DOWNLOAD

========================================================= */



const downloadQuotationPdf =

  async (

    data: QuotationData,

  ) => {

    const response =

      await fetch(

        apiUrl("/api/quotation/pdf"),

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

      let message =

        "Unable to generate quotation PDF.";



      try {

        const payload =

          await response.json();



        if (

          payload &&

          typeof payload ===

            "object" &&

          "detail" in payload

        ) {

          message =

            String(

              (

                payload as {

                  detail?: unknown;

                }

              ).detail ??

                message,

            );

        }

      } catch {

        // Keep default error.

      }



      throw new Error(

        message,

      );

    }



    const blob =

      await response.blob();



    const disposition =

      response.headers.get(

        "content-disposition",

      );



    let filename =

      "quotation.pdf";



    if (disposition) {

      const utfMatch =

        disposition.match(

          /filename\*=UTF-8''([^;]+)/i,

        );



      const normalMatch =

        disposition.match(

          /filename="?([^"]+)"?/i,

        );



      if (utfMatch?.[1]) {

        filename =

          decodeURIComponent(

            utfMatch[1],

          );

      } else if (

        normalMatch?.[1]

      ) {

        filename =

          normalMatch[1]

            .trim()

            .replace(

              /;$/,

              "",

            );

      }

    }



    const url =

      URL.createObjectURL(

        blob,

      );



    const link =

      document.createElement(

        "a",

      );



    link.href =

      url;



    link.download =

      filename;



    document.body.appendChild(

      link,

    );



    link.click();



    link.remove();



    URL.revokeObjectURL(

      url,

    );

  };





/* =========================================================

   FIELD WRAPPER

========================================================= */



interface FieldProps {

  label: string;

  children:

    React.ReactNode;

  wide?: boolean;

}





function Field({

  label,

  children,

  wide = false,

}: FieldProps) {

  return (

    <label

      className={

        wide

          ? "field field--wide"

          : "field"

      }

    >

      <span>

        {label}

      </span>



      {children}

    </label>

  );

}





/* =========================================================

   SECTION WRAPPER

========================================================= */



interface SectionProps {

  title: string;

  description?: string;

  children:

    React.ReactNode;

}





function Section({

  title,

  description,

  children,

}: SectionProps) {

  return (

    <section className="form-section">

      <div className="form-section__heading">

        <h2>

          {title}

        </h2>



        {description ? (

          <p>

            {description}

          </p>

        ) : null}

      </div>



      {children}

    </section>

  );

}





/* =========================================================

   COMPONENT

========================================================= */



const resolveProductPartId = (
  product: ProductLine,
  abstractItems: QuotationAbstractLine[],
) => {
  const requested =
    product.abstractItemId?.trim() ||
    "";

  if (
    requested &&
    abstractItems.some(
      (item) =>
        item.id === requested,
    )
  ) {
    return requested;
  }

  return (
    abstractItems[0]?.id ||
    ""
  );
};


const formatServerDateTime = (
  value: string,
): string => {
  if (!value) {
    return "—";
  }

  /*
   * SQLite may return UTC timestamps without a timezone suffix.
   * When no timezone is present, treat the value as UTC by
   * appending "Z". The browser will then display it in the
   * user's local timezone.
   */
  const hasTimezone =
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(
      value,
    );

  const normalized =
    hasTimezone
      ? value
      : `${value}Z`;

  const date =
    new Date(
      normalized,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    },
  );
};



export default function QuotationBuilder({

  selectedTemplate,

  onTemplateChange,

  onBack,

  isAdmin = false,
  hideSavedQuotationsButton = false,

  startInSavedQuotations = false,

}: Props) {

  const {
    getToken,
    isLoaded:
      isAuthLoaded,
    isSignedIn,
  } = useAuth();


  const getRequiredQuotationToken =
    async () => {

      if (!isAuthLoaded) {
        throw new Error(
          "Authentication is still loading. Please try again.",
        );
      }


      if (!isSignedIn) {
        throw new Error(
          "Authentication required. Please sign in again.",
        );
      }


      const token =
        await getToken();


      if (!token) {
        throw new Error(
          "Unable to get the Clerk session token. Please sign in again.",
        );
      }


      return token;
    };


  const [

    data,

    setData,

  ] =

    useState<QuotationData>(

      () =>

        createEmptyData(

          selectedTemplate,

        ),

    );



  const [

    downloading,

    setDownloading,

  ] =

    useState(false);



  const [

    error,

    setError,

  ] =

    useState("");



  const [

    showPreview,

    setShowPreview,

  ] =

    useState(false);



  const [

    activeEditorPage,

    setActiveEditorPage,

  ] =

    useState<EditorPage>(

      "first",

    );



  const [

    showPdfImport,

    setShowPdfImport,

  ] =

    useState(false);



  const [

    pdfImportPartId,

    setPdfImportPartId,

  ] =

    useState<string | null>(

      null,

    );


  const [

    showFullPdfImport,

    setShowFullPdfImport,

  ] =

    useState(false);


  const [

    savedQuotationId,

    setSavedQuotationId,

  ] = useState<number | null>(

    null,

  );


  const [

    savedQuotationStatus,

    setSavedQuotationStatus,

  ] = useState<QuotationSaveStatus | null>(

    null,

  );


  const [

    savingStatus,

    setSavingStatus,

  ] = useState<QuotationSaveStatus | null>(

    null,

  );


  const [

    saveMessage,

    setSaveMessage,

  ] = useState("");


  const [

    showSavedQuotations,

    setShowSavedQuotations,

  ] = useState(startInSavedQuotations);


  const [

    savedQuotations,

    setSavedQuotations,

  ] = useState<QuotationSummary[]>(

    [],

  );


  const [

    loadingSavedQuotations,

    setLoadingSavedQuotations,

  ] = useState(false);


  const [

    savedQuotationSearch,

    setSavedQuotationSearch,

  ] = useState("");


  const [

    savedQuotationFilter,

    setSavedQuotationFilter,

  ] = useState<

    "ALL" |

    QuotationSaveStatus

  >("ALL");





  const currentData =

    useMemo(

      () => ({

        ...data,

        company: {
          ...data.company,
          name: FIXED_COMPANY_NAME,
          address: FIXED_COMPANY_ADDRESS,
          email: FIXED_COMPANY_EMAIL,
          website: FIXED_COMPANY_WEBSITE,
          footerLine1: FIXED_COMPANY_NAME,
          footerLine2: FIXED_FOOTER_LINE_2,
        },

        products:

          Array.isArray(

            data.products,

          )

            ? data.products

            : [],



        columns:

          Array.isArray(

            data.columns,

          )

            ? data.columns

            : [],



        abstractItems:

          Array.isArray(

            data.abstractItems,

          )

            ? data.abstractItems

            : [],

        terms:
          Array.isArray(
            data.terms,
          )
            ? data.terms
            : createDefaultTerms(),

      }),

      [

        data,

      ],

    );





  const pdfData =

    useMemo<QuotationData>(

      () => ({

        ...currentData,

        products:

          currentData.products.filter(

            (product) =>

              product.description

                .trim(),

          ),

        abstractItems:

          currentData.abstractItems.filter(

            (item) =>

              item.description

                .trim(),

          ),

      }),

      [

        currentData,

      ],

    );




  const abstractTotal =

    useMemo(

      () =>

        currentData

          .abstractItems

          .reduce(

            (

              total,

              item,

            ) =>

              total +

              Number(

                item.price ||

                  0,

              ),

            0,

          ),

      [

        currentData

          .abstractItems,

      ],

    );





  /* =======================================================

     PATCH HELPERS

  ======================================================= */



  const patchCompany = (

    patch: Partial<

      QuotationData[

        "company"

      ]

    >,

  ) => {

    setData(

      (previous) => {

        const nextCompany = {

          ...previous.company,

          ...patch,

        };



        /*

         * Keep the editable company fields and the actual

         * quotation footer synchronized.

         *

         * Direct edits to Footer Line 1 / Footer Line 2 are

         * still respected because those patches bypass the

         * automatic sync below.

         */

        if (

          "name" in patch &&

          !("footerLine1" in patch)

        ) {

          nextCompany.footerLine1 =

            patch.name ?? "";

        }



        const footerDetailChanged =

          "address" in patch ||

          "phone" in patch ||

          "website" in patch ||

          "email" in patch;



        if (

          footerDetailChanged &&

          !("footerLine2" in patch)

        ) {

          nextCompany.footerLine2 =

            [

              nextCompany.address,

              nextCompany.phone,

              nextCompany.website,

              nextCompany.email,

            ]

              .map(

                (value) =>

                  String(

                    value ?? "",

                  ).trim(),

              )

              .filter(Boolean)

              .join(" | ");

        }



        return {

          ...previous,



          company:

            nextCompany,

        };

      },

    );

  };





  const patchCustomer = (

    patch: Partial<

      QuotationData[

        "customer"

      ]

    >,

  ) => {

    setData(

      (previous) => ({

        ...previous,



        customer: {

          ...previous.customer,

          ...patch,

        },

      }),

    );

  };





  const patchQuote = (

    patch: Partial<

      QuotationData[

        "quote"

      ]

    >,

  ) => {

    setData(

      (previous) => ({

        ...previous,



        quote: {

          ...previous.quote,

          ...patch,

        },

      }),

    );

  };





  /* =======================================================

     TEMPLATE

  ======================================================= */



  const handleTemplateChange = (

    templateId:

      TemplateId,

  ) => {

    onTemplateChange(

      templateId,

    );



    setData(

      (previous) => ({

        ...previous,



        templateId,



        theme:

          TEMPLATE_THEMES[

            templateId

          ],

      }),

    );

  };





  /* =======================================================

     ABSTRACT

  ======================================================= */



  const updateAbstractItem = (

    id: string,



    patch:

      Partial<

        QuotationAbstractLine

      >,

  ) => {

    setData(

      (previous) => ({

        ...previous,



        abstractItems:

          previous.abstractItems.map(

            (item) =>

              item.id === id

                ? {

                    ...item,

                    ...patch,

                  }

                : item,

          ),

      }),

    );

  };





  const addAbstractItem =

    () => {

      setData(

        (previous) => ({

          ...previous,



          abstractItems: [

            ...previous

              .abstractItems,



            {

              id:

                crypto.randomUUID(),



              description:

                "",



              price:

                0,

            },

          ],

        }),

      );

    };





  const removeAbstractItem = (

    id: string,

  ) => {

    setData(

      (previous) => {

        const remaining =

          previous

            .abstractItems

            .filter(

              (item) =>

                item.id !==

                id,

            );



        const nextAbstractItems =

          remaining.length >

          0

            ? remaining

            : [

                {

                  id:

                    crypto.randomUUID(),



                  description:

                    "",



                  price:

                    0,

                },

              ];



        const fallbackPartId =

          nextAbstractItems[0]

            .id;



        const nextProducts =

          previous.products.map(

            (product) => {

              const currentPartId =

                resolveProductPartId(

                  product,

                  previous.abstractItems,

                );



              if (

                currentPartId !==

                id

              ) {

                return product;

              }



              return {

                ...product,



                abstractItemId:

                  fallbackPartId,

              };

            },

          );



        return {

          ...previous,



          abstractItems:

            nextAbstractItems,



          products:

            nextProducts,

        };

      },

    );

  };



  /* =======================================================

     DIGITAL SIGNATURE

  ======================================================= */



  const handleSignatureUpload = (

    event:

      ChangeEvent<HTMLInputElement>,

  ) => {

    const file =

      event.target

        .files?.[0];



    if (!file) {

      return;

    }



    const allowedTypes = [

      "image/png",

      "image/jpeg",

      "image/webp",

    ];



    if (

      !allowedTypes.includes(

        file.type,

      )

    ) {

      setError(

        "Signature must be PNG, JPEG or WebP.",

      );



      event.target.value =

        "";



      return;

    }



    const maxSize =

      2 *

      1024 *

      1024;



    if (

      file.size >

      maxSize

    ) {

      setError(

        "Signature image must be smaller than 2 MB.",

      );



      event.target.value =

        "";



      return;

    }



    const reader =

      new FileReader();



    reader.onload =

      () => {

        const value =

          typeof reader.result ===

          "string"

            ? reader.result

            : "";



        patchCompany({

          signatureImageDataUrl:

            value,

        });



        setError("");

      };



    reader.onerror =

      () => {

        setError(

          "Unable to read the selected signature image.",

        );

      };



    reader.readAsDataURL(

      file,

    );

  };




  /* =======================================================

     PDF PRODUCT IMPORT

  ======================================================= */



  const handlePdfProductsImport = (

    products:

      ProductLine[],



    mode:

      | "replace"

      | "append",

  ) => {

    if (

      !Array.isArray(

        products,

      ) ||

      products.length ===

        0

    ) {

      setError(

        "No products were available to import.",

      );



      return;

    }



    setData(

      (previous) => {

        const abstractItems =

          Array.isArray(

            previous.abstractItems,

          )

            ? previous.abstractItems

            : [];



        const targetPartId =

          pdfImportPartId ||

          abstractItems[0]?.id ||

          "";



        if (!targetPartId) {

          setError(

            "Add an Abstract row before importing products.",

          );



          return previous;

        }



        const existingProducts =

          Array.isArray(

            previous.products,

          )

            ? previous.products

            : [];



        const importedProducts =

          products.map(

            (product) => ({

              ...product,



              id:

                product.id ||

                crypto.randomUUID(),



              abstractItemId:

                targetPartId,



              imageDataUrl:

                product.imageDataUrl ||

                "",



              description:

                product.description ||

                "",



              unit:

                product.unit ||

                "Nos",



              quantity:

                Number(

                  product.quantity ??

                    0,

                ),



              unitPrice:

                Number(

                  product.unitPrice ??

                    0,

                ),



              gstRate:

                Number(

                  product.gstRate ??

                    0,

                ),



              customValues:

                product.customValues ||

                {},

            }),

          );



        const productsOutsidePart =

          existingProducts.filter(

            (product) =>

              resolveProductPartId(

                product,

                abstractItems,

              ) !==

              targetPartId,

          );



        const productsInsidePart =

          existingProducts.filter(

            (product) =>

              resolveProductPartId(

                product,

                abstractItems,

              ) ===

              targetPartId,

          );



        const hasOnlyBlankProduct =

          productsInsidePart.length ===

            1 &&

          !productsInsidePart[0]

            .description

            .trim() &&

          Number(

            productsInsidePart[0]

              .unitPrice,

          ) === 0;



        const nextPartProducts =

          mode === "replace" ||

          hasOnlyBlankProduct

            ? importedProducts

            : [

                ...productsInsidePart,

                ...importedProducts,

              ];



        return {

          ...previous,



          products: [

            ...productsOutsidePart,

            ...nextPartProducts,

          ],

        };

      },

    );



    setShowPdfImport(

      false,

    );



    setPdfImportPartId(

      null,

    );



    setError("");

  };



  /* =======================================================

     FULL QUOTATION PDF IMPORT

     This is intentionally separate from the existing
     part-wise product PDF import.

  ======================================================= */


  const handleFullQuotationImport = (

    imported:
      FullQuotationExtractedData,

  ) => {

    setData(

      (previous) => {

        const importedCompany =
          imported.company ||
          {};


        const importedCustomer =
          imported.customer ||
          {};


        const importedQuote =
          imported.quote ||
          {};


        const importedProject =
          imported.project ||
          {};


        const nextAbstractItems =
          Array.isArray(
            imported.abstractItems,
          ) &&
          imported.abstractItems.length >
            0

            ? imported.abstractItems

            : previous.abstractItems;


        const nextProducts =
          Array.isArray(
            imported.products,
          ) &&
          imported.products.length >
            0

            ? imported.products

            : previous.products;


        const nextTerms =
          Array.isArray(
            imported.terms,
          ) &&
          imported.terms.length >
            0

            ? imported.terms

            : previous.terms;


        return {

          ...previous,


          /*
           * Preserve application-owned visual assets.
           * The visible company/bank text can come from PDF,
           * but an imported PDF should not erase the configured
           * logo or digital signature.
           */

          company: {

            ...previous.company,

            ...importedCompany,

            logoDataUrl:
              previous.company
                .logoDataUrl,

            signatureImageDataUrl:
              previous.company
                .signatureImageDataUrl,

          },


          customer: {

            ...previous.customer,

            ...importedCustomer,

          },


          quote: {

            ...previous.quote,

            ...importedQuote,

            validUntil:
              importedQuote
                .validUntil ||
              previous.quote
                .validUntil,

          },


          /*
           * Import project fields that are visibly present in the PDF
           * (for example PROJECT TYPE = VILLA) and preserve any editor
           * fields that the PDF does not contain.
           */

          project: {

            ...previous.project,

            ...Object.fromEntries(

              Object.entries(

                importedProject,

              ).filter(

                ([, value]) =>

                  String(

                    value ?? "",

                  ).trim() !== "",

              ),

            ),

          },


          abstractItems:
            nextAbstractItems,


          products:
            nextProducts,


          notes:
            imported.notes ||
            previous.notes,


          terms:
            nextTerms,


          termsAndConditions:
            imported
              .termsAndConditions ||
            previous
              .termsAndConditions,

        };

      },

    );


    /*
     * Full-PDF import starts a NEW editable quotation.
     * This prevents accidentally overwriting a quotation
     * record that happened to be open before the import.
     */

    setSavedQuotationId(

      null,

    );


    setSavedQuotationStatus(

      null,

    );


    setSaveMessage(

      "Full quotation imported. Review the fields, then save it as a new quotation.",

    );


    setShowFullPdfImport(

      false,

    );


    setShowSavedQuotations(

      false,

    );


    setShowPreview(

      false,

    );


    setActiveEditorPage(

      "first",

    );


    setError(

      "",

    );

  };



  /* =======================================================
     SELECTABLE TERMS
  ======================================================= */

  const handleTermsChange = (
    terms: QuotationTerm[],
  ) => {
    setData(
      (previous) => ({
        ...previous,

        terms,

        /*
         * Keep the existing text field synchronized.
         * This means the current preview and FastAPI PDF
         * generator immediately receive only selected terms.
         */
        termsAndConditions:
          termsToLegacyText(
            terms,
          ),
      }),
    );

    setError("");
  };





  /* =======================================================

     SAMPLE / CLEAR

  ======================================================= */
  const handleClearAll =

    () => {

      setData(

        createEmptyData(

          selectedTemplate,

        ),

      );


      setSavedQuotationId(

        null,

      );


      setSavedQuotationStatus(

        null,

      );


      setSaveMessage(

        "",

      );



      setError("");

    };





  /* =======================================================

     SAVED QUOTATIONS

  ======================================================= */


  const loadSavedQuotations =

    async () => {

      setLoadingSavedQuotations(

        true,

      );


      setError(

        "",

      );


      try {

        const token =

          await getRequiredQuotationToken();


        const result =

          await listQuotations(

            {

              limit: 500,

            },

            token,

          );


        setSavedQuotations(

          result.items,

        );

      } catch (err) {

        setError(

          err instanceof Error

            ? err.message

            : "Unable to load saved quotations.",

        );

      } finally {

        setLoadingSavedQuotations(

          false,

        );

      }

    };


  // When opened from the dashboard sidebar, fetch saved quotations
  // automatically once the Clerk session is ready.
  useEffect(() => {
    if (!startInSavedQuotations || !isAuthLoaded || !isSignedIn) return;
    let active = true;
    const loadInitialSavedQuotations = async () => {
      setLoadingSavedQuotations(true);
      try {
        const token = await getToken();
        if (!token) throw new Error("Unable to get the Clerk session token.");
        const result = await listQuotations({ limit: 500 }, token);
        if (active) setSavedQuotations(result.items);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load saved quotations.");
      } finally {
        if (active) setLoadingSavedQuotations(false);
      }
    };
    void loadInitialSavedQuotations();
    return () => { active = false; };
  }, [startInSavedQuotations, isAuthLoaded, isSignedIn, getToken]);


  const handleOpenSavedQuotations =

    async () => {

      setShowPreview(

        false,

      );


      setShowSavedQuotations(

        true,

      );


      await loadSavedQuotations();

    };


  const loadSavedQuotationIntoEditor =

    async (

      quotationId: number,

      openPreview = false,

    ) => {

      setError(

        "",

      );


      try {

        const token =

          await getRequiredQuotationToken();


        const saved =

          await getQuotation(

            quotationId,

            token,

          );


        setData(

          saved.data,

        );


        onTemplateChange(

          saved.data.templateId,

        );


        setSavedQuotationId(

          saved.id,

        );


        setSavedQuotationStatus(

          saved.status,

        );


        setSaveMessage(

          `Loaded quotation record #${saved.id}.`,

        );


        setShowSavedQuotations(

          false,

        );


        setShowPreview(

          openPreview,

        );

      } catch (err) {

        setError(

          err instanceof Error

            ? err.message

            : "Unable to open quotation.",

        );

      }

    };


  const handleDownloadSavedQuotation =

    async (

      quotationId: number,

    ) => {

      setError(

        "",

      );


      setDownloading(

        true,

      );


      try {

        const token =

          await getRequiredQuotationToken();


        const saved =

          await getQuotation(

            quotationId,

            token,

          );


        await downloadQuotationPdf(

          saved.data,

        );

      } catch (err) {

        setError(

          err instanceof Error

            ? err.message

            : "Unable to download quotation.",

        );

      } finally {

        setDownloading(

          false,

        );

      }

    };


  const handleDeleteSavedQuotation =

    async (

      quotationId: number,

    ) => {

      const confirmed =

        window.confirm(

          "Delete this saved quotation? This action cannot be undone.",

        );


      if (!confirmed) {

        return;

      }


      setError(

        "",

      );


      try {

        const token =

          await getRequiredQuotationToken();


        await deleteQuotation(

          quotationId,

          token,

        );


        if (

          savedQuotationId ===

          quotationId

        ) {

          setSavedQuotationId(

            null,

          );


          setSavedQuotationStatus(

            null,

          );


          setSaveMessage(

            "",

          );

        }


        await loadSavedQuotations();

      } catch (err) {

        setError(

          err instanceof Error

            ? err.message

            : "Unable to delete quotation.",

        );

      }

    };


  const filteredSavedQuotations =

    useMemo(

      () => {

        const search =

          savedQuotationSearch

            .trim()

            .toLowerCase();


        return savedQuotations

          .filter(

            (

              quotation,

            ) =>

              savedQuotationFilter ===

                "ALL" ||

              quotation.status ===

                savedQuotationFilter,

          )

          .filter(

            (

              quotation,

            ) => {

              if (!search) {

                return true;

              }


              return [

                quotation.quoteNumber,

                quotation.customerName,

                quotation.customerCompany,

                quotation.projectName,

              ]

                .join(" ")

                .toLowerCase()

                .includes(

                  search,

                );

            },

          );

      },

      [

        savedQuotations,

        savedQuotationSearch,

        savedQuotationFilter,

      ],

    );





  /* =======================================================

     SAVE / UPDATE

  ======================================================= */


  const handleSaveQuotation =

    async (

      status:

        QuotationSaveStatus,

    ) => {

      if (

        savingStatus

      ) {

        return;

      }


      setError(

        "",

      );


      setSaveMessage(

        "",

      );


      setSavingStatus(

        status,

      );


      try {

        const token =

          await getRequiredQuotationToken();


        const options = {

          status,

          data:

            currentData,

        };


        const saved =

          savedQuotationId ===

          null

            ? await createQuotation(

                options,

                token,

              )

            : await updateQuotation(

                savedQuotationId,

                options,

                token,

              );


        setSavedQuotationId(

          saved.id,

        );


        setSavedQuotationStatus(

          saved.status,

        );


        setSaveMessage(

          status === "DRAFT"

            ? `Draft saved successfully. Record #${saved.id}.`

            : `Quotation saved successfully. Record #${saved.id}.`,

        );

      } catch (err) {

        setError(

          err instanceof Error

            ? err.message

            : status === "DRAFT"

              ? "Unable to save draft."

              : "Unable to save quotation.",

        );

      } finally {

        setSavingStatus(

          null,

        );

      }

    };





  /* =======================================================

     DOWNLOAD

  ======================================================= */



  const handleDownload =

    async () => {

      setError("");



      const validProducts =

        pdfData.products;



      if (

        validProducts.length ===

        0

      ) {

        setError(

          "Please add at least one product before downloading the PDF.",

        );



        return;

      }



      const validAbstractItems =

        pdfData.abstractItems;



      if (

        validAbstractItems

          .length === 0

      ) {

        setError(

          "Please add at least one abstract item.",

        );



        return;

      }



      const visibleColumns =

        currentData

          .columns

          .filter(

            (column) =>

              column.visible,

          );



      if (

        visibleColumns.length ===

        0

      ) {

        setError(

          "At least one item-detail column must be visible.",

        );



        return;

      }



      setDownloading(

        true,

      );



      try {

        await downloadQuotationPdf(

          pdfData,

        );

      } catch (err) {

        setError(

          err instanceof Error

            ? err.message

            : "Unable to download quotation PDF.",

        );

      } finally {

        setDownloading(

          false,

        );

      }

    };





  /* =======================================================

     PREVIEW SCREEN

  ======================================================= */



  if (

    showSavedQuotations

  ) {

    return (

      <>

        <header

          className="topbar builder-topbar"

        >

          <div

            className="brand-lockup"

          >

            <div

              className="brand-mark"

            >

              Q

            </div>


            <div>

              <strong

                className="brand-name"

              >

                Alphanumeric QuoteDesk
</strong>


              <span

                className="brand-subtitle"

              >

                Saved Quotations

              </span>

            </div>

          </div>


          <div

            className="builder-actions"

          >

            <button

              type="button"

              className="secondary-button"

              onClick={() =>

                void loadSavedQuotations()

              }

              disabled={

                loadingSavedQuotations

              }

            >

              {loadingSavedQuotations

                ? "Refreshing..."

                : "Refresh"}

            </button>


            <button

              type="button"

              className="primary-button"

              onClick={() =>

                setShowSavedQuotations(

                  false,

                )

              }

            >

              Back to Editor

            </button>

          </div>

        </header>


        {error ? (

          <div

            className="global-error"

          >

            {error}

          </div>

        ) : null}


        <main className="qd-saved-view"

          style={{

            maxWidth:

              "1440px",

            margin:

              "0 auto",

            padding:

              "28px",

          }}

        >

          <div

            style={{

              display:

                "flex",

              gap:

                "12px",

              alignItems:

                "center",

              justifyContent:

                "space-between",

              flexWrap:

                "wrap",

              marginBottom:

                "18px",

            }}

          >

            <div>

              <h1

                style={{

                  margin: 0,

                  fontSize:

                    "26px",

                  color:

                    "#0f172a",

                }}

              >

                Saved Quotations

              </h1>


              <p

                style={{

                  margin:

                    "6px 0 0",

                  color:

                    "#64748b",

                  fontSize:

                    "14px",

                }}

              >

                Open, edit, preview,

                download or delete

                saved quotations.

              </p>

            </div>


            <div

              style={{

                display:

                  "flex",

                gap:

                  "10px",

                flexWrap:

                  "wrap",

              }}

            >

              <input

                type="search"

                value={

                  savedQuotationSearch

                }

                placeholder="Search quotation, project or creator"

                onChange={(

                  event,

                ) =>

                  setSavedQuotationSearch(

                    event.target

                      .value,

                  )

                }

                style={{

                  width:

                    "310px",

                  maxWidth:

                    "100%",

                  padding:

                    "10px 12px",

                  border:

                    "1px solid #cbd5e1",

                  background:

                    "#ffffff",

                }}

              />


              <select

                value={

                  savedQuotationFilter

                }

                onChange={(

                  event,

                ) =>

                  setSavedQuotationFilter(

                    event.target

                      .value as

                      | "ALL"

                      | QuotationSaveStatus,

                  )

                }

                style={{

                  padding:

                    "10px 12px",

                  border:

                    "1px solid #cbd5e1",

                  background:

                    "#ffffff",

                }}

              >

                <option

                  value="ALL"

                >

                  All Statuses

                </option>

                <option

                  value="DRAFT"

                >

                  Draft

                </option>

                <option

                  value="SAVED"

                >

                  Saved

                </option>

              </select>

            </div>

          </div>


          <div

            style={{

              border:

                "1px solid #e2e8f0",

              background:

                "#ffffff",

              overflowX:

                "auto",

            }}

          >

            <table

              style={{

                width:

                  "100%",

                borderCollapse:

                  "collapse",

                minWidth:

                  "1020px",

              }}

            >

              <thead>

                <tr

                  style={{

                    background:

                      "#f8fafc",

                    borderBottom:

                      "1px solid #e2e8f0",

                  }}

                >

                  {[

                    "Quote No.",

                    "Project",

                    "Created By",

                    "Date",

                    "Status",

                    "Last Updated",

                    "Actions",

                  ].map(

                    (

                      heading,

                    ) => (

                      <th

                        key={

                          heading

                        }

                        style={{

                          padding:

                            "12px 14px",

                          textAlign:

                            "left",

                          fontSize:

                            "12px",

                          color:

                            "#475569",

                          letterSpacing:

                            "0.04em",

                          textTransform:

                            "uppercase",

                        }}

                      >

                        {heading}

                      </th>

                    ),

                  )}

                </tr>

              </thead>


              <tbody>

                {loadingSavedQuotations ? (

                  <tr>

                    <td

                      colSpan={

                        7

                      }

                      style={{

                        padding:

                          "34px",

                        textAlign:

                          "center",

                        color:

                          "#64748b",

                      }}

                    >

                      Loading saved quotations...

                    </td>

                  </tr>

                ) : filteredSavedQuotations

                    .length === 0 ? (

                  <tr>

                    <td

                      colSpan={

                        7

                      }

                      style={{

                        padding:

                          "34px",

                        textAlign:

                          "center",

                        color:

                          "#64748b",

                      }}

                    >

                      No saved quotations found.

                    </td>

                  </tr>

                ) : (

                  filteredSavedQuotations.map(

                    (

                      quotation,

                    ) => (

                      <tr

                        key={

                          quotation.id

                        }

                        style={{

                          borderBottom:

                            "1px solid #e2e8f0",

                        }}

                      >

                        <td

                          style={{

                            padding:

                              "14px",

                            fontWeight:

                              600,

                            color:

                              "#0f172a",

                          }}

                        >

                          {quotation

                            .quoteNumber ||

                            `Draft #${quotation.id}`}

                        </td>


                        <td

                          style={{

                            padding:

                              "14px",

                            color:

                              "#334155",

                          }}

                        >

                          {quotation

                            .projectName ||

                            "—"}

                        </td>


                        <td

                          style={{

                            padding:

                              "14px",

                            color:

                              "#334155",

                          }}

                        >

                          <div>

                            {quotation

                              .createdByName ||

                              quotation

                                .createdByEmail ||

                              "—"}

                          </div>


                          {quotation

                            .createdByName &&

                          quotation

                            .createdByEmail ? (

                            <div

                              style={{

                                marginTop:

                                  "3px",

                                color:

                                  "#64748b",

                                fontSize:

                                  "12px",

                              }}

                            >

                              {quotation

                                .createdByEmail}

                            </div>

                          ) : null}

                        </td>


                        <td

                          style={{

                            padding:

                              "14px",

                            color:

                              "#334155",

                          }}

                        >

                          {quotation

                            .quoteDate ||

                            "—"}

                        </td>


                        <td

                          style={{

                            padding:

                              "14px",

                          }}

                        >

                          <span

                            style={{

                              display:

                                "inline-block",

                              padding:

                                "5px 8px",

                              border:

                                quotation.status ===

                                "SAVED"

                                  ? "1px solid #86efac"

                                  : "1px solid #fde68a",

                              background:

                                quotation.status ===

                                "SAVED"

                                  ? "#f0fdf4"

                                  : "#fffbeb",

                              color:

                                quotation.status ===

                                "SAVED"

                                  ? "#166534"

                                  : "#92400e",

                              fontSize:

                                "11px",

                              fontWeight:

                                700,

                            }}

                          >

                            {quotation.status}

                          </span>

                        </td>


                        <td

                          style={{

                            padding:

                              "14px",

                            color:

                              "#64748b",

                            fontSize:

                              "13px",

                          }}

                        >

                          {formatServerDateTime(

                            quotation.updatedAt,

                          )}

                        </td>


                        <td

                          style={{

                            padding:

                              "14px",

                          }}

                        >

                          <div

                            style={{

                              display:

                                "flex",

                              gap:

                                "7px",

                              flexWrap:

                                "wrap",

                            }}

                          >

                            <button

                              type="button"

                              className="secondary-button"

                              onClick={() =>

                                void loadSavedQuotationIntoEditor(

                                  quotation.id,

                                  false,

                                )

                              }

                            >

                              Edit

                            </button>


                            <button

                              type="button"

                              className="secondary-button"

                              onClick={() =>

                                void loadSavedQuotationIntoEditor(

                                  quotation.id,

                                  true,

                                )

                              }

                            >

                              Preview

                            </button>


                            <button

                              type="button"

                              className="secondary-button"

                              disabled={

                                downloading

                              }

                              onClick={() =>

                                void handleDownloadSavedQuotation(

                                  quotation.id,

                                )

                              }

                            >

                              PDF

                            </button>


                            <button

                              type="button"

                              className="secondary-button"

                              onClick={() =>

                                void handleDeleteSavedQuotation(

                                  quotation.id,

                                )

                              }

                              style={{

                                color:

                                  "#b91c1c",

                                borderColor:

                                  "#fecaca",

                              }}

                            >

                              Delete

                            </button>

                          </div>

                        </td>

                      </tr>

                    ),

                  )

                )}

              </tbody>

            </table>

          </div>

        </main>

      </>

    );

  }





  if (showPreview) {

    return (

      <>

        <header className="topbar builder-topbar">

          <div className="brand-lockup">

            <div className="brand-mark">

              Q

            </div>



            <div>

              <strong className="brand-name">

                Alphanumeric QuoteDesk
</strong>



              <span className="brand-subtitle">

                Document

                Preview

              </span>

            </div>

          </div>



          <div className="builder-actions">

            <button

              type="button"

              className="secondary-button"

              onClick={() =>

                setShowPreview(

                  false,

                )

              }

            >

              Back to Editor

            </button>



            <button

              type="button"

              className="primary-button"

              disabled={

                downloading

              }

              onClick={

                handleDownload

              }

            >

              {downloading

                ? "Generating..."

                : "Download PDF"}

            </button>

          </div>

        </header>



        {error ? (

          <div className="global-error">

            {error}

          </div>

        ) : null}



        <main className="preview-only-stage">

          <PdfQuotationPreview

            data={

              pdfData

            }

          />

        </main>



        <FullQuotationImportModal

          open={

            showFullPdfImport

          }

          onClose={() =>

            setShowFullPdfImport(

              false,

            )

          }

          onImport={

            handleFullQuotationImport

          }

        />



        <PdfImportModal

          open={

            showPdfImport

          }

  columns={
    currentData.columns
  }

          onClose={() => {

            setShowPdfImport(

              false,

            );



            setPdfImportPartId(

              null,

            );

          }}

          onImport={

            handlePdfProductsImport

          }

        />

      </>

    );

  }





  /* =======================================================

     EDITOR

  ======================================================= */



  return (

    <>

      <header className="topbar builder-topbar">

        <div className="brand-lockup">

          <div className="brand-mark">

            Q

          </div>



          <div>

            <strong className="brand-name">

              Alphanumeric QuoteDesk
</strong>



            <span className="brand-subtitle">

              Create quotation

            </span>

          </div>

        </div>



        <div className="builder-actions">
          <button

            type="button"

            className="secondary-button"

            onClick={

              handleClearAll

            }

          >

            Clear All

          </button>


          <button

            type="button"

            className="secondary-button"

            onClick={() =>

              setShowFullPdfImport(

                true,

              )

            }

          >

            Import Full Quotation PDF

          </button>



          <label className="template-switcher">

            <span>

              Template

            </span>



            <select

              value={

                currentData

                  .templateId

              }

              onChange={(

                event,

              ) =>

                handleTemplateChange(

                  event.target

                    .value as TemplateId,

                )

              }

            >

              <option value="classic">

                Classic

              </option>



              <option value="corporate">

                Corporate

              </option>



              <option value="modern">

                Modern

              </option>



              <option value="compact">

                Compact

              </option>

            </select>

          </label>



          {!isAdmin && !hideSavedQuotationsButton && (
          <button

            type="button"

            className="secondary-button"

            onClick={() =>

              void handleOpenSavedQuotations()

            }

          >

            Saved Quotations

          </button>
          )}


          {savedQuotationStatus !==

          "SAVED" ? (

            <button

              type="button"

              className="secondary-button"

              disabled={

                savingStatus !==

                null

              }

              onClick={() =>

                void handleSaveQuotation(

                  "DRAFT",

                )

              }

            >

              {savingStatus ===

              "DRAFT"

                ? "Saving Draft..."

                : savedQuotationId !==

                    null &&

                  savedQuotationStatus ===

                    "DRAFT"

                  ? "Update Draft"

                  : "Save Draft"}

            </button>

          ) : null}


          <button

            type="button"

            className="secondary-button"

            disabled={

              savingStatus !==

              null

            }

            onClick={() =>

              void handleSaveQuotation(

                "SAVED",

              )

            }

          >

            {savingStatus ===

            "SAVED"

              ? "Saving..."

              : savedQuotationId !==

                  null

                ? "Update Quotation"

                : "Save Quotation"}

          </button>


          <button

            type="button"

            className="secondary-button"

            onClick={() => {

              setError(

                "",

              );



              setShowPreview(

                true,

              );

            }}

          >

            Preview

          </button>



          <button

            type="button"

            className="primary-button"

            disabled={

              downloading

            }

            onClick={

              handleDownload

            }

          >

            {downloading

              ? "Generating..."

              : "Download PDF"}

          </button>

        </div>

      </header>





      {error ? (

        <div className="global-error">

          {error}

        </div>

      ) : null}


      {saveMessage ? (

        <div

          role="status"

          style={{

            maxWidth:

              "1440px",

            margin:

              "12px auto 0",

            padding:

              "10px 14px",

            border:

              "1px solid #cbd5e1",

            background:

              "#f8fafc",

            color:

              "#0f172a",

            fontSize:

              "13px",

          }}

        >

          {saveMessage}


          {savedQuotationId !==

          null ? (

            <span

              style={{

                marginLeft:

                  "8px",

                color:

                  "#64748b",

              }}

            >

              Status:{" "}

              {savedQuotationStatus}

            </span>

          ) : null}

        </div>

      ) : null}





      <main

        className="builder-form-panel"

        style={{

          maxWidth:

            "1440px",



          margin:

            "0 auto",



          overflow:

            "visible",



          maxHeight:

            "none",

        }}

      >

        <div className="builder-intro">

          <p className="eyebrow">

            Quotation Builder

          </p>



          <h1>

            Create your quotation

          </h1>



          <p>

            Enter quotation

            information manually

            or import product

            details directly from

            an existing PDF.

          </p>

        </div>





        <div className="quotation-workspace-nav">
          <div className="quotation-workspace-nav__header">
            <div className="quotation-workspace-nav__title">
              <span className="quotation-workspace-nav__eyebrow">
                DOCUMENT EDITOR
              </span>

              <div className="quotation-workspace-nav__title-row">
                <h2>
                  Quotation Builder
                </h2>

                <span className="quotation-workspace-nav__page-count">
                  {activeEditorPage ===
                  "first"
                    ? "Page 01 of 03"
                    : activeEditorPage ===
                        "products"
                      ? "Page 02 of 03"
                      : "Page 03 of 03"}
                </span>
              </div>
            </div>

            <p className="quotation-workspace-nav__helper">
              Edit one quotation page at a time.
            </p>
          </div>

          <div
            className="quotation-workspace-tabs"
            role="tablist"
            aria-label="Quotation editor pages"
          >
            <button
              type="button"
              role="tab"
              aria-selected={
                activeEditorPage ===
                "first"
              }
              className={`quotation-workspace-tab ${
                activeEditorPage ===
                "first"
                  ? "is-active"
                  : ""
              }`}
              onClick={() =>
                setActiveEditorPage(
                  "first",
                )
              }
            >
              <span className="quotation-workspace-tab__index">
                01
              </span>

              <span className="quotation-workspace-tab__copy">
                <strong>
                  First Page
                </strong>

                <small>
                  Client, quotation, abstract
                </small>
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={
                activeEditorPage ===
                "products"
              }
              className={`quotation-workspace-tab ${
                activeEditorPage ===
                "products"
                  ? "is-active"
                  : ""
              }`}
              onClick={() =>
                setActiveEditorPage(
                  "products",
                )
              }
            >
              <span className="quotation-workspace-tab__index">
                02
              </span>

              <span className="quotation-workspace-tab__copy">
                <strong>
                  Products BOQ
                </strong>

                <small>
                  Parts, import, products
                </small>
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={
                activeEditorPage ===
                "terms"
              }
              className={`quotation-workspace-tab ${
                activeEditorPage ===
                "terms"
                  ? "is-active"
                  : ""
              }`}
              onClick={() =>
                setActiveEditorPage(
                  "terms",
                )
              }
            >
              <span className="quotation-workspace-tab__index">
                03
              </span>

              <span className="quotation-workspace-tab__copy">
                <strong>
                  Terms & Conditions
                </strong>

                <small>
                  Terms, signature, bank
                </small>
              </span>
            </button>
          </div>
        </div>


        {activeEditorPage ===
        "first" ? (
          <div
            className="quotation-editor-page-panel"
            role="tabpanel"
          >

        {/* ===============================================

            01 COMPANY

        =============================================== */}



        <Section
          title="01 — Company Branding"
          description="The company logo and footer are fixed for every quotation."
        >
          <div className="field-grid">
            <div className="field field--wide">
              <span>Company Logo</span>
              <img
                src={`${import.meta.env.BASE_URL}company-logo.png`}
                alt="Alphanumeric Innovations logo"
                style={{
                  width: "220px",
                  maxWidth: "100%",
                  height: "85px",
                  objectFit: "contain",
                  objectPosition: "left center",
                }}
              />
            </div>
            <div className="field field--wide">
              <span>Fixed Company Footer</span>
              <strong>{FIXED_COMPANY_NAME}</strong>
              <p>{FIXED_FOOTER_LINE_2}</p>
            </div>
          </div>
        </Section>


        {/* ===============================================

            02 CLIENT

        =============================================== */}



        <Section

          title="02 — Client Information"

          description="Client details displayed on the first page."

        >

          <div className="field-grid">

            <Field label="Client Name">

              <input

                value={

                  currentData

                    .customer.name

                }

                onChange={(

                  event,

                ) =>

                  patchCustomer({

                    name:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field label="Company">

              <input

                value={

                  currentData

                    .customer

                    .company

                }

                onChange={(

                  event,

                ) =>

                  patchCustomer({

                    company:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field label="Client Number">

              <input

                value={

                  currentData

                    .customer.phone

                }

                onChange={(

                  event,

                ) =>

                  patchCustomer({

                    phone:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field label="Email">

              <input

                value={

                  currentData

                    .customer.email

                }

                onChange={(

                  event,

                ) =>

                  patchCustomer({

                    email:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field

              label="Client Address"

              wide

            >

              <textarea

                rows={3}

                value={

                  currentData

                    .customer

                    .address

                }

                onChange={(

                  event,

                ) =>

                  patchCustomer({

                    address:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field label="Client GST No.">

              <input

                value={

                  currentData

                    .customer.gstNo

                }

                onChange={(

                  event,

                ) =>

                  patchCustomer({

                    gstNo:

                      event.target

                        .value,

                  })

                }

              />

            </Field>

          </div>

        </Section>





        {/* ===============================================

            03 QUOTATION

        =============================================== */}



        <Section

          title="03 — Quotation Information"

          description="Quotation, project and MEP details."

        >

          <div className="field-grid">

            <Field label="Project Name">

              <input

                value={

                  currentData

                    .quote

                    .projectName

                }

                onChange={(

                  event,

                ) =>

                  patchQuote({

                    projectName:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field label="MEP Details">

              <input

                value={

                  currentData

                    .quote

                    .mepDetails

                }

                onChange={(

                  event,

                ) =>

                  patchQuote({

                    mepDetails:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field label="Site Location">

              <input

                value={

                  currentData

                    .quote

                    .siteLocation

                }

                onChange={(

                  event,

                ) =>

                  patchQuote({

                    siteLocation:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field label="Reference">

              <input

                value={

                  currentData

                    .quote

                    .reference

                }

                onChange={(

                  event,

                ) =>

                  patchQuote({

                    reference:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field label="Qt. No">

              <input

                value={

                  currentData

                    .quote

                    .quoteNumber

                }

                onChange={(

                  event,

                ) =>

                  patchQuote({

                    quoteNumber:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field label="Qt. Date">

              <input

                type="date"

                value={

                  currentData

                    .quote

                    .quoteDate

                }

                onChange={(

                  event,

                ) =>

                  patchQuote({

                    quoteDate:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field label="Valid Until">

              <input

                type="date"

                value={

                  currentData

                    .quote

                    .validUntil

                }

                onChange={(

                  event,

                ) =>

                  patchQuote({

                    validUntil:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field

              label="Qt. Details"

              wide

            >

              <textarea

                rows={3}

                value={

                  currentData

                    .quote

                    .quoteDetails

                }

                onChange={(

                  event,

                ) =>

                  patchQuote({

                    quoteDetails:

                      event.target

                        .value,

                  })

                }

              />

            </Field>

          </div>

        </Section>





        {/* ===============================================

            04 ABSTRACT

        =============================================== */}



        <Section

          title="04 — Page 1 Abstract"

          description="Summary lines displayed on the quotation abstract page."

        >

          <div className="abstract-editor">

            <div className="abstract-editor-header">

              <span>

                S.No

              </span>



              <span>

                Parts

              </span>



              <span>

                Description

              </span>



              <span>

                Price

              </span>



              <span>

                Action

              </span>

            </div>



            {currentData

              .abstractItems

              .map(

                (

                  item,

                  index,

                ) => (

                  <div

                    className="abstract-editor-row"

                    key={

                      item.id

                    }

                  >

                    <span className="abstract-serial">

                      {index + 1}

                    </span>



                    <span className="abstract-part-label">

                      {getPartLetterLabel(

                        index,

                      )}

                    </span>



                    <input

                      value={

                        item.description

                      }

                      placeholder="Description"

                      onChange={(

                        event,

                      ) =>

                        updateAbstractItem(

                          item.id,

                          {

                            description:

                              event

                                .target

                                .value,

                          },

                        )

                      }

                    />



                    <input

                      type="number"

                      min="0"

                      step="0.01"

                      value={

                        item.price

                      }

                      onChange={(

                        event,

                      ) =>

                        updateAbstractItem(

                          item.id,

                          {

                            price:

                              Number(

                                event

                                  .target

                                  .value,

                              ),

                          },

                        )

                      }

                    />



                    <button

                      type="button"

                      className="text-button danger"

                      onClick={() =>

                        removeAbstractItem(

                          item.id,

                        )

                      }

                    >

                      Remove

                    </button>

                  </div>

                ),

              )}



            <div className="abstract-editor-footer">

              <button

                type="button"

                className="secondary-button"

                onClick={

                  addAbstractItem

                }

              >

                + Add Abstract Item

              </button>



              <div className="abstract-editor-total">

                <span>

                  Total

                </span>



                <strong>

                  ₹

                  {abstractTotal.toLocaleString(

                    "en-IN",

                    {

                      minimumFractionDigits:

                        2,



                      maximumFractionDigits:

                        2,

                    },

                  )}

                </strong>

              </div>

            </div>

          </div>

        </Section>











          </div>
        ) : null}


        {activeEditorPage ===
        "products" ? (
          <div
            className="quotation-editor-page-panel"
            role="tabpanel"
          >

        {/* ===============================================

            06 PRODUCTS BY ABSTRACT PART

        =============================================== */}



        <Section

          title="06 — Detailed Item Details"

          description="Each Abstract row becomes a Part. Upload a PDF or add/edit products manually inside the required Part."

        >

          <div className="parts-editor">

            {currentData.abstractItems.map(

              (

                abstractItem,

                partIndex,

              ) => {

                const partProducts =

                  currentData.products.filter(

                    (product) =>

                      resolveProductPartId(

                        product,

                        currentData.abstractItems,

                      ) ===

                      abstractItem.id,

                  );



                return (

                  <div

                    className="part-product-card"

                    key={

                      abstractItem.id

                    }

                  >

                    <div className="part-product-card__header">

                      <div>

                        <div className="part-product-card__number">

                          {getPartLetterLabel(
                            partIndex,
                          )}

                        </div>



                        <h3>

                          {abstractItem.description

                            .trim() ||

                            `Abstract Row ${partIndex + 1}`}

                        </h3>

                      </div>



                      <button

                        type="button"

                        className="secondary-button"

                        onClick={() => {

                          setPdfImportPartId(

                            abstractItem.id,

                          );



                          setShowPdfImport(

                            true,

                          );

                        }}

                      >

                        Upload PDF for {getPartLetterLabel(
                          partIndex,
                        )}

                      </button>

                    </div>



                    <ProductEditor

                      products={

                        partProducts

                      }

                      columns={

                        currentData.columns

                      }

                      onChange={(

                        products,

                      ) =>

                        setData(

                          (

                            previous,

                          ) => {

                            const otherProducts =

                              previous.products.filter(

                                (product) =>

                                  resolveProductPartId(

                                    product,

                                    previous.abstractItems,

                                  ) !==

                                  abstractItem.id,

                              );



                            const nextPartProducts =

                              products.map(

                                (product) => ({

                                  ...product,



                                  abstractItemId:

                                    abstractItem.id,

                                }),

                              );



                            return {

                              ...previous,



                              products: [

                                ...otherProducts,

                                ...nextPartProducts,

                              ],

                            };

                          },

                        )

                      }

                      onColumnsChange={(

                        columns,

                      ) =>

                        setData(

                          (

                            previous,

                          ) => ({

                            ...previous,



                            columns,

                          }),

                        )

                      }

                    />

                  </div>

                );

              },

            )}

          </div>

        </Section>





        {/* ===============================================

            07 NOTES

        =============================================== */}



        <Section

          title="07 — Notes"

          description="Optional notes displayed in the quotation."

        >

          <div className="field-grid">

            <Field

              label="Notes"

              wide

            >

              <textarea

                rows={4}

                value={

                  currentData.notes

                }

                onChange={(

                  event,

                ) =>

                  setData(

                    (

                      previous,

                    ) => ({

                      ...previous,



                      notes:

                        event

                          .target

                          .value,

                    }),

                  )

                }

              />

            </Field>

          </div>

        </Section>





          </div>
        ) : null}


        {activeEditorPage ===
        "terms" ? (
          <div
            className="quotation-editor-page-panel"
            role="tabpanel"
          >

        {/* ===============================================
            08 TERMS
        =============================================== */}

        <TermsEditor
          terms={
            currentData.terms
          }
          onChange={
            handleTermsChange
          }
        />





        {/* ===============================================
            09 SIGNATURE & BANK DETAILS
        =============================================== */}

        <Section
          title="09 — Digital Signature & Bank Details"
          description="A default signature is applied automatically. Upload a different signature for this quotation when needed; bank details remain fixed."
        >
          <div className="signature-bank-editor">
            <div className="signature-bank-editor__group">
              <h3>
                Digital Signature
              </h3>

              <div className="signature-upload-area">
                <Field label="Upload Different Signature (Optional)" wide>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleSignatureUpload}
                  />
                </Field>

                <div className="signature-image-review">
                  <img
                    src={
                      currentData.company.signatureImageDataUrl ||
                      `${import.meta.env.BASE_URL}default-signature.png`
                    }
                    alt={
                      currentData.company.signatureImageDataUrl
                        ? "Custom signature for this quotation"
                        : "Default authorized signature"
                    }
                  />
                  <p>
                    {currentData.company.signatureImageDataUrl
                      ? "Custom signature selected for this quotation."
                      : "Default signature selected automatically."}
                  </p>
                  {currentData.company.signatureImageDataUrl ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        patchCompany({ signatureImageDataUrl: "" })
                      }
                    >
                      Restore Default Signature
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="signature-bank-editor__group">
              <div className="fixed-bank-heading-row">
                <h3>
                  Bank Details
                </h3>

                <span className="fixed-bank-badge">
                  FIXED
                </span>
              </div>

              <div className="fixed-bank-details">
                <div className="fixed-bank-details__row">
                  <span>Account Name</span>
                  <strong>ALPHANUMERIC INNOVATIONS PVT LTD</strong>
                </div>

                <div className="fixed-bank-details__row">
                  <span>Account Number</span>
                  <strong>50200123600412</strong>
                </div>

                <div className="fixed-bank-details__row">
                  <span>IFSC Code</span>
                  <strong>HDFC0009607</strong>
                </div>

                <div className="fixed-bank-details__row">
                  <span>Branch Name</span>
                  <strong>Hitech City-3</strong>
                </div>
              </div>

              <p className="fixed-bank-note">
                These bank details are locked and used automatically in Preview and Download PDF.
              </p>
            </div>
          </div>
        </Section>


          </div>
        ) : null}





        {/* ===============================================

            BOTTOM ACTIONS

        =============================================== */}



        <div className="builder-bottom-actions">
          <button

            type="button"

            className="secondary-button"

            onClick={() => {

              setError(

                "",

              );



              setShowPreview(

                true,

              );

            }}

          >

            Preview

          </button>



          <button

            type="button"

            className="primary-button"

            disabled={

              downloading

            }

            onClick={

              handleDownload

            }

          >

            {downloading

              ? "Generating..."

              : "Download PDF"}

          </button>

        </div>

      </main>





      {/* ===============================================

          FULL QUOTATION PDF IMPORT MODAL

          Separate from the existing part-wise product importer.

      =============================================== */}


      <FullQuotationImportModal

        open={

          showFullPdfImport

        }

        onClose={() =>

          setShowFullPdfImport(

            false,

          )

        }

        onImport={

          handleFullQuotationImport

        }

      />



      {/* ===============================================

          PDF IMPORT MODAL

      =============================================== */}



      <PdfImportModal

        open={

          showPdfImport

        }

  columns={
    currentData.columns
  }

        onClose={() => {

          setShowPdfImport(

            false,

          );



          setPdfImportPartId(

            null,

          );

        }}

        onImport={

          handlePdfProductsImport

        }

      />

    </>

  );

}