from app.models.quotation import ProductLine

#def line_base(product: ProductLine) -> float:
    #return max(0.0, product.quantity) * max(0.0, product.unitPrice)


def line_base(product: ProductLine) -> float:
    manual_amount = getattr(product, "amount", None)

    if manual_amount is not None:
        return max(0.0, float(manual_amount))

    return max(0.0, product.quantity) * max(0.0, product.unitPrice)

def line_tax(product: ProductLine) -> float:
    return line_base(product) * max(0.0, product.gstRate) / 100.0

def calculate_totals(products: list[ProductLine]) -> dict:
    subtotal = sum(line_base(p) for p in products)
    gst_by_rate: dict[float, float] = {}
    for product in products:
        if product.gstRate > 0:
            gst_by_rate[product.gstRate] = gst_by_rate.get(product.gstRate, 0.0) + line_tax(product)
    gst_total = sum(gst_by_rate.values())
    return {"subtotal": subtotal, "gst_by_rate": gst_by_rate, "gst_total": gst_total, "grand_total": subtotal + gst_total}
