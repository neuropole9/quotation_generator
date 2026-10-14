import type {
  CompanyDetails,
} from "../types/quotation";

interface Props {
  company: CompanyDetails;
}

export default function CompanyHeader({
  company,
}: Props) {
  return (
    <header className="quotation-company-header quotation-company-header--simple">
      <div className="quotation-header-spacer" />

      <div className="quotation-header-title">
        <h1>QUOTATION</h1>
      </div>

      <div className="quotation-logo-wrap">
        {company.logoDataUrl ? (
          <img
            src={company.logoDataUrl}
            alt={
              company.name
                ? `${company.name} logo`
                : "Company logo"
            }
          />
        ) : (
          <div className="quotation-logo-placeholder">
            LOGO
          </div>
        )}
      </div>
    </header>
  );
}