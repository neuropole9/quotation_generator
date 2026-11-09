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
  signatureImageDataUrl: string;
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

export interface AbstractColumn {
  id: string;
  label: string;
  visible?: boolean; // Optional for previously saved quotations.
}

export interface QuotationAbstractLine {
  customValues?: Record<string, string>;
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
  | "image"
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
  modelNumber?: string;
  imageDataUrl?: string;
  abstractItemId?: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount?: number | null;
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
  abstractColumns?: AbstractColumn[];
  products: ProductLine[];
  notes: string;
  gstEnabled?: boolean;
  terms?: QuotationTerm[];
  termsAndConditions: string;
}
