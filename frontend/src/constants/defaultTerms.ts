import type {
  QuotationTerm,
} from "../types/quotation";

export const DEFAULT_QUOTATION_TERMS:
  ReadonlyArray<QuotationTerm> = [
    {
      id: "term-1",
      selected: true,
      text:
        "This quotation is valid for 30 days from the date of quotation.",
    },
    {
      id: "term-2",
      selected: true,
      text:
        "Delivery schedule will be confirmed after receipt of the purchase order and advance payment.",
    },
    {
      id: "term-3",
      selected: true,
      text:
        "Payment Terms: 50% advance along with purchase order, 40% before dispatch and balance 10% after installation / commissioning.",
    },
    {
      id: "term-4",
      selected: true,
      text:
        "GST will be applicable as per prevailing government regulations.",
    },
    {
      id: "term-5",
      selected: true,
      text:
        "Warranty will be applicable as mentioned in the agreed technical and commercial offer.",
    },
    {
      id: "term-6",
      selected: true,
      text:
        "Any additional work or variation beyond the agreed scope will be charged separately.",
    },
    {
      id: "term-7",
      selected: true,
      text:
        "Civil works, electrical power availability, internet connectivity and other site prerequisites shall be provided by the client unless specifically included in the quotation.",
    },
    {
      id: "term-8",
      selected: true,
      text:
        "Material delivery and installation are subject to site readiness and access availability.",
    },
    {
      id: "term-9",
      selected: true,
      text:
        "Any changes in quantity, specification or scope may result in revision of the commercial value.",
    },
  ];

export const createDefaultTerms =
  (): QuotationTerm[] =>
    DEFAULT_QUOTATION_TERMS.map(
      (term) => ({
        ...term,
      }),
    );
