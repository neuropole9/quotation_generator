from app.models.quotation import ProductLine
from app.services.calculations import calculate_totals

def test_mixed_gst_totals():
    products = [
        ProductLine(id="1", description="A", quantity=2, unitPrice=5000, gstRate=18),
        ProductLine(id="2", description="B", quantity=3, unitPrice=2000, gstRate=5),
    ]
    totals = calculate_totals(products)
    assert totals["subtotal"] == 16000
    assert totals["gst_by_rate"][18] == 1800
    assert totals["gst_by_rate"][5] == 300
    assert totals["grand_total"] == 18100
