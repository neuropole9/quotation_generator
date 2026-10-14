import TemplateMiniPreview from "../components/TemplateMiniPreview";
import { quotationTemplates } from "../data/templates";
import type { TemplateId } from "../types/template";

interface Props { selectedTemplate: TemplateId; onSelect: (templateId: TemplateId) => void; onContinue: () => void; }

export default function TemplateSelection({ selectedTemplate, onSelect, onContinue }: Props) {
  return (
    <main className="template-page">
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-mark">Q</div><div><span className="brand-name">Quotation Generator</span><span className="brand-subtitle">Professional business quotations</span></div></div>
        <div className="step-indicator" aria-label="Step 1 of 2"><span className="step-indicator__active">1</span><span className="step-line" /><span>2</span></div>
      </header>
      <section className="template-content">
        <div className="page-heading"><p className="eyebrow">Step 1 of 2</p><h1>Choose your quotation template</h1><p>The quotation data stays exactly the same. Only the body layout and presentation change. The company logo, header and footer remain common.</p></div>
        <div className="template-grid">
          {quotationTemplates.map((template) => {
            const isSelected = template.id === selectedTemplate;
            return <article className={`template-card${isSelected ? " template-card--selected" : ""}`} key={template.id}>
              <div className="template-card__preview"><TemplateMiniPreview templateId={template.id} /><span className="template-badge">{template.badge}</span></div>
              <div className="template-card__body"><div><h2>{template.name}</h2><p>{template.description}</p></div><button className={isSelected ? "select-button select-button--active" : "select-button"} type="button" onClick={() => onSelect(template.id)}>{isSelected ? "Selected" : "Select template"}</button></div>
            </article>;
          })}
        </div>
        <div className="selection-footer"><div><span className="selection-label">Selected template</span><strong>{quotationTemplates.find((t) => t.id === selectedTemplate)?.name}</strong></div><button className="primary-button" type="button" onClick={onContinue}>Open quotation builder <span aria-hidden="true">→</span></button></div>
      </section>
    </main>
  );
}
