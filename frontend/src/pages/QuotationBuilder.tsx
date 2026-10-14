import {

  useMemo,

  useState,

  type ChangeEvent,

} from "react";



import PdfImportModal from "../components/PdfImportModal";

import ProductEditor from "../components/ProductEditor";

import QuotationPreview from "../components/QuotationPreview";

import TermsEditor from "../components/TermsEditor";

import { apiUrl } from "../utils/apiBase";



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



const createInitialData = (

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

      "ALPHANUMERIC INNOVATIONS PRIVATE LIMITED",



    address:

      "320, East Avenue, Fifth Floor, Ayyappa Society Main Rd, near YSR Statue, Madhapur, Hyderabad, Telangana 500081",



    phone: "",



    email:

      "alphanumericinnovations@gmail.com",



    gstNo: "",



    website:

      "www.aniplgroup.com",



    logoDataUrl: "",



    footerLine1:

      "ALPHANUMERIC INNOVATIONS PRIVATE LIMITED",



    footerLine2:

      "320, East Avenue, Fifth Floor, Ayyappa Society Main Rd, near YSR Statue, Madhapur, Hyderabad, Telangana 500081 | www.aniplgroup.com | alphanumericinnovations@gmail.com",

    signatureImageDataUrl: "",

    accountName: "ALPHANUMERIC INNOVATIONS PVT LTD",

    accountDetails: "50200123600412",

    ifscCode: "HDFC0009607",

    bankName: "Hitech City-3",

  },



  customer: {

    name: "",



    company:

      "Prestige Skytech",



    address:

      "Nanakramguda, Hyderabad",



    phone: "",



    email: "",



    gstNo: "",

  },



  quote: {

    quoteNumber:

      "PST/QT/ANIPL-2026/09-981",



    quoteDate:

      today,



    validUntil:

      getFutureDate(

        30,

      ),



    reference: "",



    siteLocation:

      "Hyderabad",



    projectName:

      "Prestige Skytech",



    mepDetails:

      "BMS / IoT Monitoring",



    quoteDetails:

      "BMS - IOT Software Design and Integration",

  },



  project: {

    panel:

      "BMS Monitoring System",



    projectType:

      "Building Management System",



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



      description:

        "Supply and installation of Nodes, sensors and Gateways",



      price:

        2582800,

    },



    {

      id:

        crypto.randomUUID(),



      description:

        "Design and Development of BMS - IOT based Monitoring Software System",



      price:

        524000,

    },



    {

      id:

        crypto.randomUUID(),



      description:

        "Installation Charges",



      price:

        583050,

    },



    {

      id:

        crypto.randomUUID(),



      description:

        "Cloud Charges Monthly Basis",



      price:

        85000,

    },

  ],



  products: [

    {

      id:

        crypto.randomUUID(),



      imageDataUrl: "",



      description:

        "IoT Gateway with Ethernet, Wi-Fi and 4G connectivity",



      unit:

        "Nos",



      quantity:

        2,



      unitPrice:

        85000,



      gstRate:

        18,



      customValues: {},

    },



    {

      id:

        crypto.randomUUID(),



      imageDataUrl: "",



      description:

        "BMS IoT Monitoring Node",



      unit:

        "Nos",



      quantity:

        10,



      unitPrice:

        42000,



      gstRate:

        18,



      customValues: {},

    },



    {

      id:

        crypto.randomUUID(),



      imageDataUrl: "",



      description:

        "Temperature and Humidity Sensor",



      unit:

        "Nos",



      quantity:

        20,



      unitPrice:

        8500,



      gstRate:

        18,



      customValues: {},

    },



    {

      id:

        crypto.randomUUID(),



      imageDataUrl: "",



      description:

        "BMS Monitoring Software Design and Integration",



      unit:

        "Lot",



      quantity:

        1,



      unitPrice:

        524000,



      gstRate:

        18,



      customValues: {},

    },



    {

      id:

        crypto.randomUUID(),



      imageDataUrl: "",



      description:

        "Installation and Commissioning",



      unit:

        "Lot",



      quantity:

        1,



      unitPrice:

        583050,



      gstRate:

        18,



      customValues: {},

    },

  ],



  notes:

    "Prices mentioned in the abstract are excluding GST.",



  terms:
    createDefaultTerms(),

  // Backward compatibility for the current preview/PDF generator.
  termsAndConditions:
    termsToLegacyText(
      createDefaultTerms(),
    ),

});





/* =========================================================

   EMPTY DATA

========================================================= */



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

      "ALPHANUMERIC INNOVATIONS PRIVATE LIMITED",



    address: "",



    phone: "",



    email:

      "alphanumericinnovations@gmail.com",



    gstNo: "",



    website:

      "www.aniplgroup.com",



    logoDataUrl: "",



    footerLine1:

      "ALPHANUMERIC INNOVATIONS PRIVATE LIMITED",



    footerLine2: "",

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


export default function QuotationBuilder({

  selectedTemplate,

  onTemplateChange,

  onBack,

}: Props) {

  const [

    data,

    setData,

  ] =

    useState<QuotationData>(

      () =>

        createInitialData(

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





  const currentData =

    useMemo(

      () => ({

        ...data,



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





  const patchProject = (

    patch: Partial<

      QuotationData[

        "project"

      ]

    >,

  ) => {

    setData(

      (previous) => ({

        ...previous,



        project: {

          ...previous.project,

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

     LOGO

  ======================================================= */



  const handleLogoUpload = (

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

        "Logo must be PNG, JPEG or WebP.",

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

        "Logo must be smaller than 2 MB.",

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

          logoDataUrl:

            value,

        });



        setError("");

      };



    reader.onerror =

      () => {

        setError(

          "Unable to read the selected logo.",

        );

      };



    reader.readAsDataURL(

      file,

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



  const handleLoadSample =

    () => {

      setData(

        createInitialData(

          selectedTemplate,

        ),

      );



      setError("");

    };





  const handleClearAll =

    () => {

      setData(

        createEmptyData(

          selectedTemplate,

        ),

      );



      setError("");

    };





  /* =======================================================

     DOWNLOAD

  ======================================================= */



  const handleDownload =

    async () => {

      setError("");



      const validProducts =

        currentData.products.filter(

          (product) =>

            product.description

              .trim(),

        );



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

        currentData

          .abstractItems

          .filter(

            (item) =>

              item.description

                .trim(),

          );



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

          {

            ...currentData,



            products:

              validProducts,



            abstractItems:

              validAbstractItems,

          },

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

                Quotation

                Generator

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

          <QuotationPreview

            data={

              currentData

            }

          />

        </main>



        <PdfImportModal

          open={

            showPdfImport

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

              Quotation

              Generator

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

              onBack

            }

          >

            Templates

          </button>
          <button

            type="button"

            className="secondary-button"

            onClick={

              handleLoadSample

            }

          >

            Load Sample Data

          </button>



          <button

            type="button"

            className="secondary-button"

            onClick={

              handleClearAll

            }

          >

            Clear All

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
                  Product Details
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

          title="01 — Logo & Company Footer"

          description="Company details and footer are synchronized live. You can also override Footer Line 1 and Footer Line 2 directly."

        >

          <div className="field-grid">

            <Field

              label="Company Name"

              wide

            >

              <input

                value={

                  currentData

                    .company.name

                }

                onChange={(

                  event,

                ) =>

                  patchCompany({

                    name:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field

              label="Company Address"

              wide

            >

              <textarea

                rows={3}

                value={

                  currentData

                    .company.address

                }

                onChange={(

                  event,

                ) =>

                  patchCompany({

                    address:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field label="Phone">

              <input

                value={

                  currentData

                    .company.phone

                }

                onChange={(

                  event,

                ) =>

                  patchCompany({

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

                    .company.email

                }

                onChange={(

                  event,

                ) =>

                  patchCompany({

                    email:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field label="GST No.">

              <input

                value={

                  currentData

                    .company.gstNo

                }

                onChange={(

                  event,

                ) =>

                  patchCompany({

                    gstNo:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field label="Website">

              <input

                value={

                  currentData

                    .company.website

                }

                onChange={(

                  event,

                ) =>

                  patchCompany({

                    website:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field

              label="Company Logo"

              wide

            >

              <input

                type="file"

                accept="image/png,image/jpeg,image/webp"

                onChange={

                  handleLogoUpload

                }

              />



              {currentData

                .company

                .logoDataUrl ? (

                <div

                  style={{

                    marginTop:

                      "10px",



                    display:

                      "flex",



                    alignItems:

                      "center",



                    gap:

                      "12px",

                  }}

                >

                  <img

                    src={

                      currentData

                        .company

                        .logoDataUrl

                    }

                    alt="Company logo"

                    style={{

                      width:

                        "110px",



                      height:

                        "65px",



                      objectFit:

                        "contain",



                      border:

                        "1px solid #d9dee6",



                      background:

                        "#ffffff",

                    }}

                  />



                  <button

                    type="button"

                    className="secondary-button"

                    onClick={() =>

                      patchCompany({

                        logoDataUrl:

                          "",

                      })

                    }

                  >

                    Remove Logo

                  </button>

                </div>

              ) : null}

            </Field>



            <Field

              label="Footer Line 1"

              wide

            >

              <input

                value={

                  currentData

                    .company

                    .footerLine1 ??

                  ""

                }

                onChange={(

                  event,

                ) =>

                  patchCompany({

                    footerLine1:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field

              label="Footer Line 2"

              wide

            >

              <textarea

                rows={2}

                value={

                  currentData

                    .company

                    .footerLine2 ??

                  ""

                }

                onChange={(

                  event,

                ) =>

                  patchCompany({

                    footerLine2:

                      event.target

                        .value,

                  })

                }

              />

            </Field>

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





        {/* ===============================================

            05 TECHNICAL INFORMATION

        =============================================== */}



        <Section

          title="05 — Technical Information"

          description="Optional technical information for the quotation."

        >

          <div className="field-grid">

            <Field label="Panel">

              <input

                value={

                  currentData

                    .project.panel

                }

                onChange={(

                  event,

                ) =>

                  patchProject({

                    panel:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field label="Project Type">

              <input

                value={

                  currentData

                    .project

                    .projectType

                }

                onChange={(

                  event,

                ) =>

                  patchProject({

                    projectType:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field label="Cabinet">

              <input

                value={

                  currentData

                    .project

                    .cabinet

                }

                onChange={(

                  event,

                ) =>

                  patchProject({

                    cabinet:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field label="Module">

              <input

                value={

                  currentData

                    .project.module

                }

                onChange={(

                  event,

                ) =>

                  patchProject({

                    module:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field label="Screen Size">

              <input

                value={

                  currentData

                    .project

                    .screenSize

                }

                onChange={(

                  event,

                ) =>

                  patchProject({

                    screenSize:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field label="Module Size">

              <input

                value={

                  currentData

                    .project

                    .moduleSize

                }

                onChange={(

                  event,

                ) =>

                  patchProject({

                    moduleSize:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field label="Height">

              <input

                value={

                  currentData

                    .project.height

                }

                onChange={(

                  event,

                ) =>

                  patchProject({

                    height:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field label="Width">

              <input

                value={

                  currentData

                    .project.width

                }

                onChange={(

                  event,

                ) =>

                  patchProject({

                    width:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field label="Quantity">

              <input

                value={

                  currentData

                    .project

                    .quantity

                }

                onChange={(

                  event,

                ) =>

                  patchProject({

                    quantity:

                      event.target

                        .value,

                  })

                }

              />

            </Field>



            <Field label="Module Dot">

              <input

                value={

                  currentData

                    .project

                    .moduleDot

                }

                onChange={(

                  event,

                ) =>

                  patchProject({

                    moduleDot:

                      event.target

                        .value,

                  })

                }

              />

            </Field>

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
          description="Upload the digital signature. Bank details are fixed and will be printed automatically on the final Terms & Conditions page."
        >
          <div className="signature-bank-editor">
            <div className="signature-bank-editor__group">
              <h3>
                Digital Signature
              </h3>

              <div className="signature-upload-area">
                <Field
                  label="Digital Signature Image"
                  wide
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={
                      handleSignatureUpload
                    }
                  />
                </Field>

                {currentData.company
                  .signatureImageDataUrl ? (
                  <div className="signature-image-review">
                    <img
                      src={
                        currentData.company
                          .signatureImageDataUrl
                      }
                      alt="Digital signature"
                    />

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        patchCompany({
                          signatureImageDataUrl:
                            "",
                        })
                      }
                    >
                      Remove Signature
                    </button>
                  </div>
                ) : null}
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

          PDF IMPORT MODAL

      =============================================== */}



      <PdfImportModal

        open={

          showPdfImport

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