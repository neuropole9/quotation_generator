from typing import Literal

from pydantic import BaseModel, Field


TemplateId = Literal[
    "classic",
    "corporate",
    "modern",
    "compact",
]

QuotationColumnKind = Literal[
    "serial",
    "modelNumber",
    "image",  # legacy compatibility
    "description",
    "unit",
    "quantity",
    "unitPrice",
    "gstRate",
    "amount",
    "customText",
    "customNumber",
    "customCurrency",
]


class CompanyDetails(BaseModel):
    name: str = ""
    address: str = ""
    phone: str = ""
    email: str = ""
    gstNo: str = ""
    website: str = ""
    logoDataUrl: str = ""
    footerLine1: str = ""
    footerLine2: str = ""

    # Digital signature displayed on the final Terms page.
    signatureImageDataUrl: str = ""

    # Editable bank details displayed on the final Terms page.
    accountName: str = ""
    accountDetails: str = ""
    ifscCode: str = ""
    bankName: str = ""


class CustomerDetails(BaseModel):
    name: str = ""
    company: str = ""
    address: str = ""
    phone: str = ""
    email: str = ""
    gstNo: str = ""


class QuoteDetails(BaseModel):
    quoteNumber: str = ""
    quoteDate: str = ""
    validUntil: str = ""
    reference: str = ""
    siteLocation: str = ""
    projectName: str = ""
    mepDetails: str = ""
    quoteDetails: str = ""


class ProjectDetails(BaseModel):
    panel: str = ""
    projectType: str = ""
    cabinet: str = ""
    module: str = ""
    screenSize: str = ""
    moduleSize: str = ""
    height: str = ""
    width: str = ""
    quantity: str = ""
    moduleDot: str = ""


class QuotationAbstractLine(BaseModel):
    id: str
    description: str = ""
    price: float = 0


class QuotationColumn(BaseModel):
    id: str
    label: str
    kind: QuotationColumnKind
    visible: bool = True


class QuotationTerm(BaseModel):
    id: str
    text: str = ""
    selected: bool = True
    isCustom: bool = False


class ProductLine(BaseModel):
    id: str

    # New visible field.
    modelNumber: str = ""

    # Legacy field retained so older saved/imported payloads remain valid.
    imageDataUrl: str = ""

    # Abstract row / Part association. Blank legacy products belong to Part 1.
    abstractItemId: str = ""

    description: str = ""
    unit: str = "Nos"
    quantity: float = 0
    unitPrice: float = 0
    gstRate: float = 0
    customValues: dict[
        str,
        str | int | float,
    ] = Field(
        default_factory=dict
    )


class QuotationTheme(BaseModel):
    primaryColor: str = "#111111"
    secondaryColor: str = "#f5f5f5"


class QuotationData(BaseModel):
    templateId: TemplateId = "classic"
    theme: QuotationTheme = Field(
        default_factory=QuotationTheme
    )
    columns: list[QuotationColumn] = Field(
        default_factory=list
    )
    company: CompanyDetails = Field(
        default_factory=CompanyDetails
    )
    customer: CustomerDetails = Field(
        default_factory=CustomerDetails
    )
    quote: QuoteDetails = Field(
        default_factory=QuoteDetails
    )
    project: ProjectDetails = Field(
        default_factory=ProjectDetails
    )
    abstractItems: list[
        QuotationAbstractLine
    ] = Field(
        default_factory=list
    )
    products: list[ProductLine] = Field(
        default_factory=list
    )
    notes: str = ""
    terms: list[QuotationTerm] = Field(
        default_factory=list
    )
    # Legacy field kept so older payloads continue to work.
    termsAndConditions: str = ""
