import type { TemplateId } from "../types/template";

export default function TemplateMiniPreview({ templateId }: { templateId: TemplateId }) {
  return (
    <div className={`mini-preview mini-preview--${templateId}`} aria-hidden="true">
      <div className="mini-header"><div className="mini-logo">LOGO</div><div className="mini-company-lines"><span /><span /></div></div>
      <div className="mini-title">QUOTATION</div>
      <div className="mini-details"><span /><span /><span /></div>
      <div className="mini-table"><strong /><span /><span /><span /><span /></div>
      <div className="mini-totals"><span /><span /><strong /></div>
      <div className="mini-footer" />
    </div>
  );
}
