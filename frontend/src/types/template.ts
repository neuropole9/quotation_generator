export type TemplateId =
  | "classic"
  | "corporate"
  | "modern"
  | "compact";

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  description: string;
  badge: string;
}