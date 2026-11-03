#!/usr/bin/env python3
"""Synchronize TallyPrime Day Book vouchers into Supabase using the REST API."""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any


TALLY_URL = "http://localhost:9000"
CENT = Decimal("0.01")
MAX_RESPONSE_BYTES = 50 * 1024 * 1024
UPSERT_BATCH_SIZE = 250
TAX_LEDGER_TOKENS = {
    "cgst": ("cgst",),
    "sgst": ("sgst",),
    "igst": ("igst",),
}


class SyncError(Exception):
    """An expected configuration, transport, or data error during synchronization."""


@dataclass(frozen=True)
class Voucher:
    tally_voucher_id: str
    voucher_number: str | None
    voucher_type: str
    voucher_date: date
    party_name: str | None
    total_amount: Decimal
    sales_amount: Decimal
    purchase_amount: Decimal
    expense_amount: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    raw_ledger_entries: list[dict[str, str]]


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].upper()


def _child_text(element: ET.Element, *names: str) -> str | None:
    expected = {name.upper() for name in names}
    for child in element.iter():
        if child is element or _local_name(child.tag) not in expected:
            continue
        if child.text and child.text.strip():
            return child.text.strip()
    return None


def _attribute(element: ET.Element, *names: str) -> str | None:
    expected = {name.upper() for name in names}
    for key, value in element.attrib.items():
        if key.upper() in expected and value.strip():
            return value.strip()
    return None


def _decimal(value: str | None) -> Decimal:
    if not value:
        return Decimal("0")
    text = value.strip().replace(",", "")
    negative = text.startswith("(") and text.endswith(")")
    if negative:
        text = text[1:-1]
    text = re.sub(r"[^0-9.\-]", "", text)
    if not text or text in {"-", ".", "-."}:
        return Decimal("0")
    try:
        result = Decimal(text)
    except InvalidOperation as error:
        raise SyncError("Tally returned an invalid monetary amount.") from error
    return -result if negative else result


def _money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def _parse_date(value: str | None) -> date:
    if not value:
        raise SyncError("A Tally voucher is missing its date.")
    for pattern in ("%Y%m%d", "%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value[:10], pattern).date()
        except ValueError:
            continue
    raise SyncError("Tally returned a voucher date in an unsupported format.")


def _normalize_voucher_type(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().casefold()
    aliases = {
        "sales": ("sales", "sale"),
        "purchase": ("purchase", "purchases"),
        "receipt": ("receipt", "receipts"),
        "payment": ("payment", "payments"),
    }
    for voucher_type, names in aliases.items():
        if any(
            normalized == name or normalized.startswith(f"{name} ")
            for name in names
        ):
            return voucher_type
    return None


def build_daybook_request(
    company_name: str, from_date: date, to_date: date
) -> bytes:
    envelope = ET.Element("ENVELOPE")
    header = ET.SubElement(envelope, "HEADER")
    ET.SubElement(header, "TALLYREQUEST").text = "Export Data"
    body = ET.SubElement(envelope, "BODY")
    export_data = ET.SubElement(body, "EXPORTDATA")
    request_description = ET.SubElement(export_data, "REQUESTDESC")
    ET.SubElement(request_description, "REPORTNAME").text = "Day Book"
    variables = ET.SubElement(request_description, "STATICVARIABLES")
    ET.SubElement(variables, "SVEXPORTFORMAT").text = "$$SysName:XML"
    ET.SubElement(variables, "SVFROMDATE").text = from_date.strftime("%Y%m%d")
    ET.SubElement(variables, "SVTODATE").text = to_date.strftime("%Y%m%d")
    ET.SubElement(variables, "SVCURRENTCOMPANY").text = company_name
    return ET.tostring(envelope, encoding="utf-8", xml_declaration=True)


def _ledger_entries(voucher_element: ET.Element) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    for entry in voucher_element.iter():
        if not _local_name(entry.tag).endswith("LEDGERENTRIES.LIST"):
            continue
        ledger_name = _child_text(entry, "LEDGERNAME")
        amount = _child_text(entry, "AMOUNT")
        if not ledger_name or amount is None:
            continue
        entries.append({"ledger_name": ledger_name, "amount": amount})
    return entries


def _tax_amounts(entries: list[dict[str, str]]) -> dict[str, Decimal]:
    totals = {name: Decimal("0") for name in TAX_LEDGER_TOKENS}
    for entry in entries:
        ledger_name = entry["ledger_name"].casefold()
        for tax_name, tokens in TAX_LEDGER_TOKENS.items():
            if any(token in ledger_name for token in tokens):
                totals[tax_name] += abs(_decimal(entry["amount"]))
                break
    return {name: _money(amount) for name, amount in totals.items()}


def parse_daybook_xml(
    xml_bytes: bytes, expense_ledger_names: set[str] | None = None
) -> list[Voucher]:
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as error:
        raise SyncError("Tally returned malformed XML.") from error

    line_errors = [
        item.text.strip()
        for item in root.iter()
        if _local_name(item.tag) == "LINEERROR" and item.text and item.text.strip()
    ]
    if line_errors:
        raise SyncError(f"Tally rejected the Day Book request: {line_errors[0]}")
    if any(
        item.text and item.text.strip() == "0"
        for item in root.iter()
        if _local_name(item.tag) == "STATUS"
    ):
        raise SyncError("Tally reported an unsuccessful Day Book export.")

    configured_expenses = {
        name.strip().casefold()
        for name in expense_ledger_names or set()
        if name.strip()
    }
    vouchers: dict[str, Voucher] = {}
    for element in root.iter():
        if _local_name(element.tag) != "VOUCHER":
            continue
        voucher_type = _normalize_voucher_type(
            _attribute(element, "VCHTYPE", "VOUCHERTYPENAME")
            or _child_text(element, "VOUCHERTYPENAME")
        )
        if voucher_type is None:
            continue

        voucher_date = _parse_date(_child_text(element, "DATE"))
        raw_entries = _ledger_entries(element)
        taxes = _tax_amounts(raw_entries)
        tax_total = sum(taxes.values(), Decimal("0"))
        voucher_amount = _child_text(element, "AMOUNT")
        if voucher_amount is not None:
            total_amount = abs(_decimal(voucher_amount))
        else:
            total_amount = sum(
                (abs(_decimal(entry["amount"])) for entry in raw_entries),
                Decimal("0"),
            ) / 2
        total_amount = _money(total_amount)

        sales_amount = Decimal("0")
        purchase_amount = Decimal("0")
        expense_amount = Decimal("0")
        if voucher_type == "sales":
            sales_amount = _money(max(total_amount - tax_total, Decimal("0")))
        elif voucher_type == "purchase":
            purchase_amount = _money(max(total_amount - tax_total, Decimal("0")))
        elif voucher_type == "payment" and configured_expenses:
            expense_amount = _money(
                sum(
                    (
                        abs(_decimal(entry["amount"]))
                        for entry in raw_entries
                        if entry["ledger_name"].casefold() in configured_expenses
                    ),
                    Decimal("0"),
                )
            )

        voucher_number = _child_text(element, "VOUCHERNUMBER")
        stable_id = (
            _child_text(element, "MASTERID", "GUID", "REMOTEID")
            or _attribute(element, "GUID", "REMOTEID")
        )
        if stable_id:
            voucher_id = stable_id
        elif voucher_number:
            fallback_identity = (
                f"{voucher_date.isoformat()}|{voucher_type}|{voucher_number}"
            )
            voucher_id = "fallback-" + hashlib.sha256(
                fallback_identity.encode("utf-8")
            ).hexdigest()
        else:
            raise SyncError(
                "A Tally voucher has neither a stable ID nor a voucher number."
            )

        vouchers[voucher_id] = Voucher(
            tally_voucher_id=voucher_id,
            voucher_number=voucher_number,
            voucher_type=voucher_type,
            voucher_date=voucher_date,
            party_name=_child_text(element, "PARTYLEDGERNAME", "PARTYNAME"),
            total_amount=total_amount,
            sales_amount=sales_amount,
            purchase_amount=purchase_amount,
            expense_amount=expense_amount,
            cgst_amount=taxes["cgst"],
            sgst_amount=taxes["sgst"],
            igst_amount=taxes["igst"],
            raw_ledger_entries=raw_entries,
        )
    return list(vouchers.values())


def summarize_vouchers(vouchers: list[Voucher]) -> list[dict[str, Any]]:
    groups: dict[date, list[Voucher]] = defaultdict(list)
    for voucher in vouchers:
        period_start = voucher.voucher_date.replace(day=1)
        groups[period_start].append(voucher)

    summaries: list[dict[str, Any]] = []
    for period_start, period_vouchers in sorted(groups.items()):
        next_month = (
            period_start.replace(year=period_start.year + 1, month=1)
            if period_start.month == 12
            else period_start.replace(month=period_start.month + 1)
        )
        period_end = next_month - timedelta(days=1)
        sales = sum(
            (item.sales_amount for item in period_vouchers), Decimal("0")
        )
        purchases = sum(
            (item.purchase_amount for item in period_vouchers), Decimal("0")
        )
        expenses = sum(
            (item.expense_amount for item in period_vouchers), Decimal("0")
        )
        gst_payable = sum(
            (
                item.cgst_amount + item.sgst_amount + item.igst_amount
                for item in period_vouchers
                if item.voucher_type == "sales"
            ),
            Decimal("0"),
        )
        gst_input = sum(
            (
                item.cgst_amount + item.sgst_amount + item.igst_amount
                for item in period_vouchers
                if item.voucher_type == "purchase"
            ),
            Decimal("0"),
        )
        summaries.append(
            {
                "period_start": period_start.isoformat(),
                "period_end": period_end.isoformat(),
                "total_sales": _money(sales),
                "total_purchases": _money(purchases),
                "total_expenses": _money(expenses),
                "net_profit": _money(sales - purchases - expenses),
                "gst_payable": _money(gst_payable),
                "gst_input": _money(gst_input),
            }
        )
    return summaries


def _retry_delay(attempt: int) -> None:
    time.sleep(min(2**attempt, 30))


def _http_request(
    request: urllib.request.Request, retries: int, timeout: int
) -> bytes:
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                body = response.read(MAX_RESPONSE_BYTES + 1)
                if len(body) > MAX_RESPONSE_BYTES:
                    raise SyncError("The Tally response exceeded the 50 MB limit.")
                return body
        except urllib.error.HTTPError as error:
            if error.code == 429 or 500 <= error.code < 600:
                if attempt < retries:
                    _retry_delay(attempt)
                    continue
            raise SyncError(
                f"Remote service returned HTTP {error.code}."
            ) from error
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            if attempt < retries:
                _retry_delay(attempt)
                continue
            raise SyncError("Unable to reach a configured remote service.") from error
    raise SyncError("Remote service retry limit was reached.")


def fetch_tally_daybook(
    company_name: str,
    from_date: date,
    to_date: date,
    retries: int,
    timeout: int,
) -> bytes:
    request = urllib.request.Request(
        TALLY_URL,
        data=build_daybook_request(company_name, from_date, to_date),
        headers={"Content-Type": "application/xml; charset=utf-8"},
        method="POST",
    )
    return _http_request(request, retries, timeout)


def _supabase_upsert(
    supabase_url: str,
    service_key: str,
    table: str,
    conflict_columns: str,
    rows: list[dict[str, Any]],
    retries: int,
    timeout: int,
) -> None:
    if not rows:
        return
    encoded_conflict = urllib.parse.quote(conflict_columns, safe="")
    url = f"{supabase_url.rstrip('/')}/rest/v1/{table}?on_conflict={encoded_conflict}"
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    for offset in range(0, len(rows), UPSERT_BATCH_SIZE):
        payload = json.dumps(
            rows[offset : offset + UPSERT_BATCH_SIZE],
            separators=(",", ":"),
        ).encode("utf-8")
        request = urllib.request.Request(
            url, data=payload, headers=headers, method="POST"
        )
        _http_request(request, retries, timeout)


def _voucher_row(company_id: str, voucher: Voucher) -> dict[str, Any]:
    return {
        "company_id": company_id,
        "tally_voucher_id": voucher.tally_voucher_id,
        "voucher_number": voucher.voucher_number,
        "voucher_type": voucher.voucher_type,
        "voucher_date": voucher.voucher_date.isoformat(),
        "party_name": voucher.party_name,
        "total_amount": str(voucher.total_amount),
        "sales_amount": str(voucher.sales_amount),
        "purchase_amount": str(voucher.purchase_amount),
        "expense_amount": str(voucher.expense_amount),
        "cgst_amount": str(voucher.cgst_amount),
        "sgst_amount": str(voucher.sgst_amount),
        "igst_amount": str(voucher.igst_amount),
        "raw_ledger_entries": voucher.raw_ledger_entries,
        "updated_at": datetime.now().astimezone().isoformat(),
    }


def _summary_row(
    company_id: str, summary: dict[str, Any], synced_at: str
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "company_id": company_id,
        "period_start": summary["period_start"],
        "period_end": summary["period_end"],
        "last_synced_at": synced_at,
        "updated_at": synced_at,
    }
    for field in (
        "total_sales",
        "total_purchases",
        "total_expenses",
        "net_profit",
        "gst_payable",
        "gst_input",
    ):
        row[field] = str(summary[field])
    return row


def _date_from_environment(name: str, fallback: date) -> date:
    value = os.environ.get(name)
    if not value:
        return fallback
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise SyncError(f"{name} must use YYYY-MM-DD format.") from error


def _required_environment(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SyncError(f"Required environment variable {name} is missing.")
    return value


def _validate_supabase_url(value: str) -> str:
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme == "https" and parsed.hostname and not parsed.username:
        return value.rstrip("/")
    if parsed.scheme == "http" and parsed.hostname in {
        "localhost",
        "127.0.0.1",
        "::1",
    }:
        return value.rstrip("/")
    raise SyncError(
        "SUPABASE_URL must use HTTPS, except for a local development endpoint."
    )


def run_sync() -> tuple[int, int]:
    supabase_url_setting = (
        os.environ.get("SUPABASE_URL")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        or ""
    ).strip()
    if not supabase_url_setting:
        raise SyncError("Required environment variable SUPABASE_URL is missing.")
    supabase_url = _validate_supabase_url(supabase_url_setting)
    service_key = _required_environment("SUPABASE_SERVICE_ROLE_KEY")
    company_id = _required_environment("TALLY_COMPANY_ID")
    try:
        company_id = str(uuid.UUID(company_id))
    except ValueError as error:
        raise SyncError("TALLY_COMPANY_ID must be a valid company UUID.") from error
    company_name = _required_environment("TALLY_COMPANY_NAME")

    today = date.today()
    fiscal_year_start = date(today.year if today.month >= 4 else today.year - 1, 4, 1)
    from_date = _date_from_environment("TALLY_SYNC_FROM_DATE", fiscal_year_start)
    to_date = _date_from_environment("TALLY_SYNC_TO_DATE", today)
    if from_date > to_date:
        raise SyncError("TALLY_SYNC_FROM_DATE must not be after TALLY_SYNC_TO_DATE.")

    try:
        retries = int(os.environ.get("TALLY_SYNC_RETRIES", "3"))
        timeout = int(os.environ.get("TALLY_SYNC_TIMEOUT", "30"))
    except ValueError as error:
        raise SyncError("Retry count and timeout must be whole numbers.") from error
    if not 0 <= retries <= 10 or not 1 <= timeout <= 300:
        raise SyncError("Retry count must be 0–10 and timeout must be 1–300 seconds.")

    expenses = {
        name.strip()
        for name in os.environ.get("TALLY_EXPENSE_LEDGER_NAMES", "").split(",")
        if name.strip()
    }
    tally_xml = fetch_tally_daybook(
        company_name, from_date, to_date, retries, timeout
    )
    vouchers = parse_daybook_xml(tally_xml, expenses)
    summaries = summarize_vouchers(vouchers)
    synced_at = datetime.now().astimezone().isoformat()

    voucher_rows = [_voucher_row(company_id, voucher) for voucher in vouchers]
    _supabase_upsert(
        supabase_url,
        service_key,
        "vouchers",
        "company_id,tally_voucher_id",
        voucher_rows,
        retries,
        timeout,
    )
    summary_rows = [
        _summary_row(company_id, summary, synced_at) for summary in summaries
    ]
    _supabase_upsert(
        supabase_url,
        service_key,
        "financial_summaries",
        "company_id,period_start",
        summary_rows,
        retries,
        timeout,
    )
    return len(voucher_rows), len(summary_rows)


def main() -> int:
    try:
        voucher_count, summary_count = run_sync()
    except SyncError as error:
        print(f"Tally sync failed: {error}", file=sys.stderr)
        return 1
    print(
        f"Tally sync complete: {voucher_count} vouchers and "
        f"{summary_count} monthly summaries upserted."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
