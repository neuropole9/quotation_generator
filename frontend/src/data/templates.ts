import type {
  TemplateDefinition,
} from "../types/template";

export const quotationTemplates: TemplateDefinition[] = [
  {
    id: "classic",

    name: "Green Quote",

    description:
      "Classic quotation layout with green accents, customer section, structured product table and totals block.",

    badge: "Template 1",
  },

  {
    id: "corporate",

    name: "Brown Corporate",

    description:
      "Structured corporate quotation with brown section bars, business details, billing section and professional table layout.",

    badge: "Template 2",
  },

  {
    id: "modern",

    name: "Purple Modern",

    description:
      "Modern business quotation with purple accents, clean section hierarchy, structured customer details and product table.",

    badge: "Template 3",
  },

  {
    id: "compact",

    name: "Compact Business",

    description:
      "Compact professional quotation designed for larger product lists while keeping the same company header, logo and footer.",

    badge: "Template 4",
  },
];