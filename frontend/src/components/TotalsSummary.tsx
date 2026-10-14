import type { ProductLine } from "../types/quotation";
import { calculateTotals, formatCurrency } from "../utils/calculations";

export default function TotalsSummary({ products }: { products: ProductLine[] }) {
  const totals = calculateTotals(products);
  return (
    <div className="quotation-totals">
      <div><span>Subtotal</span><strong>{formatCurrency(totals.subtotal)}</strong></div>
      {Object.entries(totals.gstByRate).sort(([a], [b]) => Number(a) - Number(b)).map(([rate, amount]) => (
        <div key={rate}><span>GST {rate}%</span><strong>{formatCurrency(amount)}</strong></div>
      ))}
      <div className="quotation-totals__grand"><span>Grand Total</span><strong>{formatCurrency(totals.grandTotal)}</strong></div>
    </div>
  );
}
