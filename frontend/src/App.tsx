import QuotationBuilder from "./pages/QuotationBuilder";

/*
 * The application now has one approved quotation design.
 * The old template-selection screen is intentionally bypassed.
 *
 * We still pass "classic" internally because the existing quotation
 * data model/PDF API contains templateId for backward compatibility.
 * It is no longer a user-selectable template.
 */
export default function App() {
  return (
    <QuotationBuilder
      selectedTemplate="classic"
      onTemplateChange={() => {
        // Template switching is disabled.
      }}
      onBack={() => {
        // There is no template-selection page anymore.
      }}
    />
  );
}
