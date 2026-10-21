import type { CompanyDetails } from "../types/quotation";

interface Props {
  company: CompanyDetails;
}

export default function CompanyHeader({ company }: Props) {
  return (
    <header className="quotation-company-header quotation-company-header--simple">
      <div className="quotation-header-spacer" />
      <div className="quotation-header-title">
        <h1>QUOTATION</h1>
      </div>
      <div className="quotation-logo-wrap">
        <img
          src={`${import.meta.env.BASE_URL}company-logo.png`}
          alt={company.name ? `${company.name} logo` : "Company logo"}
        />
      </div>
    </header>
  );
}
