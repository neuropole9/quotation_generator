import type { ProductLine } from "../types/quotation";

export const GST_RATES = [0, 5, 12, 18, 28] as const;

export function lineBase(product: ProductLine): number {
  return Math.max(0, Number(product.quantity) || 0) * Math.max(0, Number(product.unitPrice) || 0);
}

export function lineTax(product: ProductLine): number {
  return lineBase(product) * (Math.max(0, Number(product.gstRate) || 0) / 100);
}

export function lineTotal(product: ProductLine): number {
  return lineBase(product) + lineTax(product);
}

export function calculateTotals(products: ProductLine[]) {
  const subtotal = products.reduce((sum, product) => sum + lineBase(product), 0);
  const gstByRate = products.reduce<Record<number, number>>((result, product) => {
    const rate = Number(product.gstRate) || 0;
    if (rate > 0) result[rate] = (result[rate] || 0) + lineTax(product);
    return result;
  }, {});
  const gstTotal = Object.values(gstByRate).reduce((sum, value) => sum + value, 0);
  return { subtotal, gstByRate, gstTotal, grandTotal: subtotal + gstTotal };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}
