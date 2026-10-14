import type { TemplateId } from "./template";

export interface CompanyDetails {
  name: string;
  address: string;
  phone: string;
  email: string;
  gstNo: string;
  website: string;
  logoDataUrl: string;
  footerLine1: string;
  footerLine2: string;

  // Digital signature shown on the final Terms & Conditions page.
  signatureImageDataUrl: string;

  // Editable bank details shown on the final Terms & Conditions page.
  accountName: string;
  accountDetails: string;
  ifscCode: string;
  bankName: string;
}

export interface CustomerDetails {
  name: string;
  company: string;
  address: string;
  phone: string;
  email: string;
  gstNo: string;
}

export interface QuoteDetails {
  quoteNumber: string;
  quoteDate: string;
  validUntil: string;
  reference: string;
  siteLocation: string;
  projectName: string;
  mepDetails: string;
  quoteDetails: string;
}

export interface ProjectDetails {
  panel: string;
  projectType: string;
  cabinet: string;
  module: string;
  screenSize: string;
  moduleSize: string;
  height: string;
  width: string;
  quantity: string;
  moduleDot: string;
}

export interface QuotationAbstractLine {
  id: string;
  description: string;
  price: number;
}

export interface QuotationTerm {
  id: string;
  text: string;
  selected: boolean;
  isCustom?: boolean;
}

export type QuotationColumnKind =
  | "serial"
  | "modelNumber"
  | "image" // legacy compatibility: rendered as Model Number
  | "description"
  | "unit"
  | "quantity"
  | "unitPrice"
  | "gstRate"
  | "amount"
  | "customText"
  | "customNumber"
  | "customCurrency";

export interface QuotationColumn {
  id: string;
  label: string;
  kind: QuotationColumnKind;
  visible: boolean;
}

export interface ProductLine {
  id: string;

  /**
   * New visible product field.
   * The old image column is retained only for backward compatibility.
   */
  modelNumber?: string;

  /**
   * Legacy field. Existing saved/imported data can still contain it,
   * but the quotation table no longer displays a product image column.
   */
  imageDataUrl?: string;

  /**
   * Links this product to one Abstract row.
   * Product Details uses the Abstract row as its Part heading.
   * Older products without this value are treated as Part 1.
   */
  abstractItemId?: string;

  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  customValues: Record<string, string | number>;
}

export interface QuotationTheme {
  primaryColor: string;
  secondaryColor: string;
}

export interface QuotationData {
  templateId: TemplateId;
  theme: QuotationTheme;
  columns: QuotationColumn[];
  company: CompanyDetails;
  customer: CustomerDetails;
  quote: QuoteDetails;
  project: ProjectDetails;
  abstractItems: QuotationAbstractLine[];
  products: ProductLine[];
  notes: string;

  /** Selectable Terms & Conditions used by the new editor/PDF. */
  terms?: QuotationTerm[];

  /** Legacy free-text field kept for backward compatibility. */
  termsAndConditions: string;
}
