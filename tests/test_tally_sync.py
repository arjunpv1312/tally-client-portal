import unittest
import os
import ssl
from datetime import date
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.error import URLError
from urllib.request import Request
from unittest.mock import Mock, patch

from tally_sync import (
    _NoRedirectHandler,
    SyncError,
    _load_env_file,
    _http_request,
    _company_id_from_environment,
    _voucher_row,
    _validate_supabase_url,
    _validate_tally_url,
    build_daybook_request,
    main,
    parse_daybook_xml,
    run_daemon,
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
                "tally_sync.urllib.request.build_opener"
            ) as urlopen,
            patch("tally_sync.urllib.request.ProxyHandler") as proxy_handler,
            patch("tally_sync._retry_delay") as retry_delay,
        ):
            opener = Mock()
            opener.open.side_effect = [URLError("offline"), BytesIO(b"response")]
            urlopen.return_value = opener
            response = _http_request(request, retries=1, timeout=1)
        self.assertEqual(response, b"response")
        self.assertEqual(opener.open.call_count, 2)
        proxy_handler.assert_called_once_with({})
        retry_delay.assert_called_once_with(0)

    def test_https_requests_use_direct_tls_13_transport(self) -> None:
        request = Request("https://project.example/rest/v1/vouchers")
        with (
            patch("tally_sync.urllib.request.build_opener") as build_opener,
            patch("tally_sync.urllib.request.ProxyHandler") as proxy_handler,
            patch("tally_sync.urllib.request.HTTPSHandler") as https_handler,
        ):
            opener = Mock()
            opener.open.return_value = BytesIO(b"response")
            build_opener.return_value = opener
            self.assertEqual(_http_request(request, retries=0, timeout=1), b"response")

        proxy_handler.assert_called_once_with({})
        context = https_handler.call_args.kwargs["context"]
        self.assertEqual(context.minimum_version, ssl.TLSVersion.TLSv1_3)
        opener.open.assert_called_once_with(request, timeout=1)

    def test_http_redirects_are_not_followed(self) -> None:
        redirect_handler = _NoRedirectHandler()
        self.assertIsNone(
            redirect_handler.redirect_request(
                Request("https://project.example/rest/v1/vouchers"),
                Mock(),
                307,
                "Temporary Redirect",
                {},
                "https://other.example/rest/v1/vouchers",
            )
        )

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

    def test_validates_tally_host(self) -> None:
        self.assertEqual(
            _validate_tally_url("http://127.0.0.1:9000/"),
            "http://127.0.0.1:9000",
        )
        self.assertEqual(
            _validate_tally_url("http://localhost:9000"),
            "http://127.0.0.1:9000",
        )
        for unsafe_url in (
            "http://192.168.1.20:9000",
            "http://127.0.0.1:9001",
            "https://127.0.0.1:9000",
        ):
            with self.subTest(url=unsafe_url), self.assertRaises(SyncError):
                _validate_tally_url(unsafe_url)

    def test_loads_env_file_without_overriding_existing_environment(self) -> None:
        with TemporaryDirectory() as directory:
            env_path = Path(directory) / ".env"
            env_path.write_text(
                'SUPABASE_URL="https://env.supabase.co"\n'
                "TALLY_COMPANY_NAME=Acme Traders\n",
                encoding="utf-8",
            )
            with patch.dict(
                os.environ,
                {"SUPABASE_URL": "https://existing.supabase.co"},
                clear=True,
            ):
                _load_env_file(env_path)
                self.assertEqual(
                    os.environ["SUPABASE_URL"], "https://existing.supabase.co"
                )
                self.assertEqual(os.environ["TALLY_COMPANY_NAME"], "Acme Traders")

    def test_company_id_supports_legacy_target_name(self) -> None:
        with patch.dict(
            os.environ,
            {"TARGET_COMPANY_ID": "target-id"},
            clear=True,
        ):
            self.assertEqual(_company_id_from_environment(), "target-id")

    def test_company_id_prefers_current_name_when_both_are_set(self) -> None:
        with patch.dict(
            os.environ,
            {
                "TALLY_COMPANY_ID": "tally-id",
                "TARGET_COMPANY_ID": "target-id",
            },
            clear=True,
        ):
            self.assertEqual(_company_id_from_environment(), "tally-id")

    def test_company_id_requires_either_supported_environment_variable(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(SyncError, "TALLY_COMPANY_ID"):
                _company_id_from_environment()

    def test_main_reports_success_through_structured_logging(self) -> None:
        with patch("tally_sync.run_sync", return_value=(2, 1)):
            with self.assertLogs("tally_sync", level="INFO") as logs:
                self.assertEqual(main(["--once"]), 0)
        self.assertEqual(logs.records[-1].levelname, "SUCCESS")
        self.assertIn("Tally sync complete", logs.records[-1].getMessage())

    def test_main_reports_sync_errors_through_structured_logging(self) -> None:
        with patch("tally_sync.run_sync", side_effect=SyncError("missing config")):
            with self.assertLogs("tally_sync", level="ERROR") as logs:
                self.assertEqual(main(["--once"]), 1)
        self.assertEqual(logs.records[-1].levelname, "ERROR")
        self.assertIn("Tally sync failed: missing config", logs.records[-1].getMessage())

    def test_daemon_runs_periodic_sync_then_final_shutdown_flush(self) -> None:
        stop_event = Mock()
        stop_event.is_set.return_value = False
        stop_event.wait.return_value = True
        with (
            patch("tally_sync.threading.Event", return_value=stop_event),
            patch("tally_sync.signal.signal"),
            patch("tally_sync.atexit.register"),
            patch("tally_sync.atexit.unregister"),
            patch("tally_sync.run_sync", return_value=(1, 1)) as sync,
        ):
            self.assertEqual(run_daemon(interval_seconds=1800), 0)
        self.assertEqual(sync.call_count, 2)
        stop_event.wait.assert_called_once_with(1800)


if __name__ == "__main__":
    unittest.main()
