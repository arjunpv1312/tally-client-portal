import unittest
from datetime import date
from decimal import Decimal
from io import BytesIO
from urllib.error import URLError
from urllib.request import Request
from unittest.mock import patch

from tally_sync import (
    SyncError,
    _http_request,
    _voucher_row,
    _validate_supabase_url,
    build_daybook_request,
    parse_daybook_xml,
    summarize_vouchers,
)


DAYBOOK_XML = b"""<?xml version="1.0"?>
<ENVELOPE>
  <BODY><DATA><TALLYMESSAGE>
    <VOUCHER VCHTYPE="Sales">
      <DATE>20261015</DATE><MASTERID>sales-1</MASTERID>
      <VOUCHERNUMBER>S-001</VOUCHERNUMBER><PARTYLEDGERNAME>Client A</PARTYLEDGERNAME>
      <AMOUNT>-118.00</AMOUNT>
      <ALLLEDGERENTRIES.LIST><LEDGERNAME>Sales</LEDGERNAME><AMOUNT>-100.00</AMOUNT></ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST><LEDGERNAME>CGST Output</LEDGERNAME><AMOUNT>-9.00</AMOUNT></ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST><LEDGERNAME>SGST Output</LEDGERNAME><AMOUNT>-9.00</AMOUNT></ALLLEDGERENTRIES.LIST>
    </VOUCHER>
    <VOUCHER VCHTYPE="Purchase">
      <DATE>20261020</DATE><MASTERID>purchase-1</MASTERID>
      <VOUCHERNUMBER>P-001</VOUCHERNUMBER><AMOUNT>236.00</AMOUNT>
      <ALLLEDGERENTRIES.LIST><LEDGERNAME>Purchases</LEDGERNAME><AMOUNT>200.00</AMOUNT></ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST><LEDGERNAME>CGST Input</LEDGERNAME><AMOUNT>18.00</AMOUNT></ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST><LEDGERNAME>SGST Input</LEDGERNAME><AMOUNT>18.00</AMOUNT></ALLLEDGERENTRIES.LIST>
    </VOUCHER>
    <VOUCHER VCHTYPE="Payment">
      <DATE>20261021</DATE><MASTERID>payment-1</MASTERID>
      <VOUCHERNUMBER>PAY-001</VOUCHERNUMBER><AMOUNT>50.00</AMOUNT>
      <ALLLEDGERENTRIES.LIST><LEDGERNAME>Office Rent</LEDGERNAME><AMOUNT>50.00</AMOUNT></ALLLEDGERENTRIES.LIST>
    </VOUCHER>
    <VOUCHER VCHTYPE="Journal"><DATE>20261022</DATE><MASTERID>journal-1</MASTERID></VOUCHER>
  </TALLYMESSAGE></DATA></BODY>
</ENVELOPE>
"""


class TallySyncTests(unittest.TestCase):
    def test_builds_daybook_request_with_company_and_dates(self) -> None:
        request = build_daybook_request(
            "Client & Sons", date(2026, 4, 1), date(2026, 10, 31)
        )
        self.assertIn(b"Client &amp; Sons", request)
        self.assertIn(b"<SVFROMDATE>20260401</SVFROMDATE>", request)
        self.assertIn(b"<SVTODATE>20261031</SVTODATE>", request)

    def test_parses_vouchers_tax_and_configured_expense_ledgers(self) -> None:
        vouchers = parse_daybook_xml(
            DAYBOOK_XML, expense_ledger_names={"Office Rent"}
        )
        self.assertEqual(
            [voucher.voucher_type for voucher in vouchers],
            ["sales", "purchase", "payment"],
        )
        sales, purchase, payment = vouchers
        self.assertEqual(sales.sales_amount, Decimal("100.00"))
        self.assertEqual(sales.cgst_amount, Decimal("9.00"))
        self.assertEqual(sales.sgst_amount, Decimal("9.00"))
        self.assertEqual(purchase.purchase_amount, Decimal("200.00"))
        self.assertEqual(payment.expense_amount, Decimal("50.00"))
        self.assertEqual(payment.total_amount, Decimal("50.00"))
        row = _voucher_row("company-1", payment)
        self.assertEqual(row["total_amount"], row["amount"])
        self.assertEqual(row["date"], row["voucher_date"])

    def test_payment_is_not_assumed_to_be_an_expense(self) -> None:
        payment = parse_daybook_xml(DAYBOOK_XML)[2]
        self.assertEqual(payment.expense_amount, Decimal("0.00"))

    def test_summarizes_by_month_and_excludes_unclassified_payments(self) -> None:
        vouchers = parse_daybook_xml(
            DAYBOOK_XML, expense_ledger_names={"Office Rent"}
        )
        summary = summarize_vouchers(vouchers)[0]
        self.assertEqual(summary["period_start"], "2026-10-01")
        self.assertEqual(summary["period_end"], "2026-10-31")
        self.assertEqual(summary["total_sales"], Decimal("100.00"))
        self.assertEqual(summary["total_purchases"], Decimal("200.00"))
        self.assertEqual(summary["total_expenses"], Decimal("50.00"))
        self.assertEqual(summary["net_profit"], Decimal("-150.00"))
        self.assertEqual(summary["gst_payable"], Decimal("18.00"))
        self.assertEqual(summary["gst_input"], Decimal("36.00"))

    def test_rejects_malformed_or_error_xml(self) -> None:
        with self.assertRaises(SyncError):
            parse_daybook_xml(b"<ENVELOPE>")
        with self.assertRaises(SyncError):
            parse_daybook_xml(b"<ENVELOPE><LINEERROR>Unknown company</LINEERROR></ENVELOPE>")

    def test_uses_stable_fallback_id_when_tally_id_is_missing(self) -> None:
        first = b"""<ENVELOPE><VOUCHER VCHTYPE="Sales">
          <DATE>20261015</DATE><VOUCHERNUMBER>S-002</VOUCHERNUMBER>
          <AMOUNT>100</AMOUNT></VOUCHER></ENVELOPE>"""
        changed = b"""<ENVELOPE><VOUCHER VCHTYPE="Sales">
          <DATE>20261015</DATE><VOUCHERNUMBER>S-002</VOUCHERNUMBER>
          <AMOUNT>125</AMOUNT></VOUCHER></ENVELOPE>"""
        first_id = parse_daybook_xml(first)[0].tally_voucher_id
        changed_id = parse_daybook_xml(changed)[0].tally_voucher_id
        self.assertEqual(first_id, changed_id)
        self.assertTrue(first_id.startswith("fallback-"))

    def test_retries_network_errors(self) -> None:
        request = Request("http://localhost:9000")
        with (
            patch(
                "tally_sync.urllib.request.urlopen",
                side_effect=[URLError("offline"), BytesIO(b"response")],
            ) as urlopen,
            patch("tally_sync._retry_delay") as retry_delay,
        ):
            response = _http_request(request, retries=1, timeout=1)
        self.assertEqual(response, b"response")
        self.assertEqual(urlopen.call_count, 2)
        retry_delay.assert_called_once_with(0)

    def test_requires_tls_for_remote_supabase(self) -> None:
        self.assertEqual(
            _validate_supabase_url("https://project.example/"),
            "https://project.example",
        )
        self.assertEqual(
            _validate_supabase_url("http://localhost:54321"),
            "http://localhost:54321",
        )
        with self.assertRaises(SyncError):
            _validate_supabase_url("http://localhost.evil.test")


if __name__ == "__main__":
    unittest.main()
