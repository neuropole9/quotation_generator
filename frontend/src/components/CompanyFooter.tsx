import type { CompanyDetails } from "../types/quotation";

export default function CompanyFooter({ company }: { company: CompanyDetails }) {
  return (
    <footer className="quotation-company-footer">
      <div>{company.footerLine1 || "Thank you for your business."}</div>
      <div>{company.footerLine2 || [company.phone, company.email, company.website].filter(Boolean).join("  •  ")}</div>
    </footer>
  );
}
