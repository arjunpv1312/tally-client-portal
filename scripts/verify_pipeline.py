#!/usr/bin/env python3
"""Isolated FINORA Supabase pipeline verification with mandatory cleanup."""

from __future__ import annotations

import argparse
import json
import re
import secrets
import sys
import time
from concurrent.futures import ThreadPoolExecutor
import http.client
import urllib.error
import urllib.parse
import urllib.request
from decimal import Decimal
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
TEST_MARKER = "__FINORA_E2E_TEST__"
TEST_TOKEN_PATTERN = re.compile(
    r"__FINORA_E2E_TEST__|(?:^|[^A-Z0-9])TEST(?:$|[^A-Z0-9])|"
    r"TEST_BATCH_|TEST_PURCHASE_",
    re.IGNORECASE,
)


class VerificationError(RuntimeError):
    pass


def contains_test_marker(value: Any) -> bool:
    return bool(TEST_TOKEN_PATTERN.search(str(value)))


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        name, value = stripped.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        values[name.strip()] = value
    return values


ENV: dict[str, str] = {}
ENV.update(load_env_file(ROOT / ".env"))
ENV.update(load_env_file(ROOT / ".env.local"))

SUPABASE_URL = (ENV.get("SUPABASE_URL") or ENV.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
SERVICE_KEY = ENV.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()


def rest_request(
    method: str,
    path: str,
    *,
    payload: Any = None,
    query: dict[str, str] | None = None,
    prefer: str | None = None,
) -> tuple[int, Any]:
    if not SUPABASE_URL or not SERVICE_KEY:
        raise VerificationError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for pipeline verification."
        )
    url = SUPABASE_URL + path
    if query:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(query)
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Accept": "application/json",
    }
    if payload is not None:
        headers["Content-Type"] = "application/json"
    if prefer:
        headers["Prefer"] = prefer
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers=headers,
        method=method,
    )
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                raw = response.read()
                return response.status, json.loads(raw.decode("utf-8")) if raw else None
        except urllib.error.HTTPError as error:
            raw = error.read()
            try:
                detail = json.loads(raw.decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                detail = raw.decode("utf-8", "replace")
            raise VerificationError(
                f"Supabase REST {method} failed with HTTP {error.code}: {detail}"
            ) from error
        except (urllib.error.URLError, http.client.RemoteDisconnected, TimeoutError, ConnectionResetError) as error:
            last_error = error
            if attempt < 2:
                time.sleep(1 + attempt)
            continue
    raise VerificationError(
        f"Unable to reach Supabase REST API after 3 attempts: {last_error}"
    )


def table_exists(table: str) -> bool:
    try:
        rest_request("GET", f"/rest/v1/{table}", query={"select": "*", "limit": "1"})
        return True
    except VerificationError as error:
        if "HTTP 404" in str(error) or "PGRST205" in str(error):
            return False
        raise


def column_exists(table: str, column: str) -> bool:
    try:
        rest_request(
            "GET",
            f"/rest/v1/{table}",
            query={"select": column, "limit": "1"},
        )
        return True
    except VerificationError as error:
        if "HTTP 400" in str(error) or "42703" in str(error):
            return False
        raise


def get_rows(table: str, query: dict[str, str]) -> list[dict[str, Any]]:
    _, data = rest_request(
        "GET",
        f"/rest/v1/{table}",
        query={"select": "*", **query},
    )
    return data if isinstance(data, list) else []


def delete_rows(table: str, query: dict[str, str]) -> None:
    rest_request("DELETE", f"/rest/v1/{table}", query=query, prefer="return=minimal")


def decimal_value(value: Any) -> Decimal:
    return Decimal(str(value or "0"))


def cleanup_test_data(
    *,
    company_ids: set[str] | None = None,
    auth_user_ids: set[str] | None = None,
) -> dict[str, int]:
    counts = {
        "companies": 0,
        "company_employees": 0,
        "vouchers": 0,
        "financial_summaries": 0,
        "employee_work_logs": 0,
        "sync_runs": 0,
        "audit_logs": 0,
        "profiles": 0,
        "auth_users": 0,
    }
    target_ids = set(company_ids or set())
    target_auth_user_ids = set(auth_user_ids or set())

    companies = get_rows(
        "companies",
        {"select": "id,name", "name": "ilike.*TEST*", "limit": "1000"},
    )
    marker_companies = [
        row
        for row in companies
        if contains_test_marker(row.get("name", ""))
    ]
    for row in marker_companies:
        target_ids.add(str(row["id"]))

    if table_exists("profiles"):
        profiles = get_rows("profiles", {"select": "*", "limit": "10000"})
        for profile in profiles:
            if contains_test_marker(
                f"{profile.get('email', '')} {profile.get('full_name', '')}"
            ):
                profile_id = str(profile["id"])
                target_auth_user_ids.add(profile_id)
                delete_rows("profiles", {"id": f"eq.{profile_id}"})
                counts["profiles"] += 1

    if table_exists("vouchers"):
        all_vouchers = get_rows(
            "vouchers",
            {"select": "id,tally_voucher_id,company_id", "limit": "10000"},
        )
        for row in all_vouchers:
            tally_id = str(row.get("tally_voucher_id", "")).upper()
            company_id = str(row.get("company_id", ""))
            if contains_test_marker(tally_id) or company_id in target_ids:
                delete_rows("vouchers", {"id": f"eq.{row['id']}"})
                counts["vouchers"] += 1

    if table_exists("financial_summaries"):
        for company_id in target_ids:
            before = get_rows(
                "financial_summaries",
                {"select": "id", "company_id": f"eq.{company_id}", "limit": "1000"},
            )
            delete_rows(
                "financial_summaries",
                {"company_id": f"eq.{company_id}"},
            )
            counts["financial_summaries"] += len(before)

    if table_exists("sync_runs"):
        for company_id in target_ids:
            before = get_rows(
                "sync_runs",
                {"select": "id", "company_id": f"eq.{company_id}", "limit": "1000"},
            )
            delete_rows("sync_runs", {"company_id": f"eq.{company_id}"})
            counts["sync_runs"] += len(before)

    if table_exists("employee_work_logs"):
        for company_id in target_ids:
            before = get_rows(
                "employee_work_logs",
                {"select": "id", "company_id": f"eq.{company_id}", "limit": "1000"},
            )
            delete_rows("employee_work_logs", {"company_id": f"eq.{company_id}"})
            counts["employee_work_logs"] += len(before)

    if table_exists("company_employees"):
        for company_id in target_ids:
            before = get_rows(
                "company_employees",
                {"select": "id", "company_id": f"eq.{company_id}", "limit": "1000"},
            )
            delete_rows("company_employees", {"company_id": f"eq.{company_id}"})
            counts["company_employees"] += len(before)

    if table_exists("audit_logs"):
        audit_rows = get_rows("audit_logs", {"select": "*", "limit": "10000"})
        for row in audit_rows:
            details = row.get("details")
            details_text = json.dumps(details) if details is not None else ""
            company_id = (
                str(details.get("company_id", ""))
                if isinstance(details, dict)
                else ""
            )
            entity_id = str(row.get("entity_id", ""))
            if (
                company_id in target_ids
                or contains_test_marker(entity_id)
                or contains_test_marker(details_text)
                or contains_test_marker(json.dumps(row, ensure_ascii=False))
            ):
                delete_rows("audit_logs", {"id": f"eq.{row['id']}"})
                counts["audit_logs"] += 1

    for company_id in target_ids:
        delete_rows("companies", {"id": f"eq.{company_id}"})
        counts["companies"] += 1

    for auth_user_id in target_auth_user_ids:
        try:
            status, _ = rest_request(
                "DELETE",
                f"/auth/v1/admin/users/{auth_user_id}",
            )
        except VerificationError as error:
            if "HTTP 404" not in str(error):
                raise
        else:
            if status in {200, 204}:
                counts["auth_users"] += 1

    return counts


def assert_zero_test_residue(
    company_ids: set[str] | None = None,
) -> dict[str, int]:
    known_test_company_ids = company_ids or set()
    residue = {
        "companies": 0,
        "vouchers": 0,
        "financial_summaries": 0,
        "employee_work_logs": 0,
        "sync_runs": 0,
        "audit_logs": 0,
        "profiles": 0,
    }

    companies = get_rows("companies", {"select": "*", "limit": "10000"})
    test_company_ids = {
        str(row["id"])
        for row in companies
        if contains_test_marker(json.dumps(row, ensure_ascii=False))
    }
    known_test_company_ids = known_test_company_ids | test_company_ids
    residue["companies"] = sum(
        1
        for row in companies
        if contains_test_marker(json.dumps(row, ensure_ascii=False))
    )

    if table_exists("vouchers"):
        vouchers = get_rows("vouchers", {"select": "*", "limit": "10000"})
        residue["vouchers"] = sum(
            1
            for row in vouchers
            if (
                contains_test_marker(json.dumps(row, ensure_ascii=False))
                or str(row.get("company_id", "")) in known_test_company_ids
            )
        )

    if table_exists("financial_summaries"):
        summaries = get_rows(
            "financial_summaries",
            {"select": "*", "limit": "10000"},
        )
        residue["financial_summaries"] = sum(
            1
            for row in summaries
            if str(row.get("company_id", "")) in known_test_company_ids
        )

    if table_exists("employee_work_logs"):
        work_logs = get_rows("employee_work_logs", {"select": "*", "limit": "10000"})
        residue["employee_work_logs"] = sum(
            1
            for row in work_logs
            if (
                contains_test_marker(json.dumps(row, ensure_ascii=False))
                or str(row.get("company_id", "")) in known_test_company_ids
            )
        )

    if table_exists("sync_runs"):
        sync_runs = get_rows("sync_runs", {"select": "*", "limit": "10000"})
        residue["sync_runs"] = sum(
            1
            for row in sync_runs
            if (
                str(row.get("company_id", "")) in known_test_company_ids
                or contains_test_marker(json.dumps(row, ensure_ascii=False))
            )
        )

    if table_exists("audit_logs"):
        audit_logs = get_rows("audit_logs", {"select": "*", "limit": "10000"})
        residue["audit_logs"] = sum(
            1
            for row in audit_logs
            if (
                contains_test_marker(json.dumps(row, ensure_ascii=False))
                or (
                    isinstance(row.get("details"), dict)
                    and str(row["details"].get("company_id", ""))
                    in known_test_company_ids
                )
            )
        )

    if table_exists("profiles"):
        profiles = get_rows("profiles", {"select": "*", "limit": "10000"})
        residue["profiles"] = sum(
            1
            for row in profiles
            if contains_test_marker(
                f"{row.get('email', '')} {row.get('full_name', '')}"
            )
        )

    if any(residue.values()):
        raise VerificationError(
            f"Test data residue remains after cleanup: {residue}"
        )
    return residue


def create_employee_profile_and_work_log(
    company_id: str,
    created_auth_user_ids: set[str],
) -> tuple[str, str]:
    profiles = get_rows(
        "profiles",
        {"select": "id,email,role", "role": "eq.employee", "limit": "1"},
    )
    if profiles:
        employee_id = str(profiles[0]["id"])
    else:
        email = f"{TEST_MARKER.lower()}-{secrets.token_hex(6)}@example.invalid"
        password = secrets.token_urlsafe(32)
        status, auth_payload = rest_request(
            "POST",
            "/auth/v1/admin/users",
            payload={
                "email": email,
                "password": password,
                "email_confirm": True,
                "app_metadata": {"provider": "email", "providers": ["email"]},
                "user_metadata": {"full_name": TEST_MARKER},
            },
            prefer="return=representation",
        )
        if status not in {200, 201} or not isinstance(auth_payload, dict):
            raise VerificationError("Unable to create the synthetic E2E auth user.")
        employee_id = str(auth_payload["id"])
        created_auth_user_ids.add(employee_id)
        rest_request(
            "POST",
            "/rest/v1/profiles",
            payload={
                "id": employee_id,
                "email": email,
                "full_name": TEST_MARKER,
                "role": "employee",
                "company_id": company_id,
            },
            prefer="return=representation",
        )

    assignment_payload: dict[str, Any] = {"company_id": company_id}
    for column in ("employee_id", "user_id"):
        if column_exists("company_employees", column):
            assignment_payload[column] = employee_id
    if not any(column in assignment_payload for column in ("employee_id", "user_id")):
        raise VerificationError(
            "The company assignment table has neither employee_id nor user_id."
        )
    if column_exists("company_employees", "entry_status"):
        assignment_payload["entry_status"] = "pending"
    rest_request(
        "POST",
        "/rest/v1/company_employees",
        payload=assignment_payload,
        prefer="resolution=merge-duplicates,return=representation",
    )
    status, work_logs = rest_request(
        "POST",
        "/rest/v1/employee_work_logs",
        payload={
            "user_id": employee_id,
            "company_id": company_id,
            "completed_tasks": [f"{TEST_MARKER} completed"],
            "pending_work": [f"{TEST_MARKER} pending work"],
            "pending_tasks": [f"{TEST_MARKER} pending task"],
        },
        prefer="return=representation",
    )
    if status not in {200, 201} or not isinstance(work_logs, list) or not work_logs:
        raise VerificationError("Employee work-log verification did not return a row.")
    work_log = work_logs[0]
    return employee_id, str(work_log["id"])


def run_multi_company_concurrency_check() -> dict[str, Decimal]:
    company_ids: set[str] = set()
    company_totals: dict[str, Decimal] = {}

    def create_company(worker_index: int) -> tuple[str, str]:
        name = f"{TEST_MARKER} Concurrent {worker_index}"
        status, companies = rest_request(
            "POST",
            "/rest/v1/companies",
            payload={"name": name, "gstin": None, "email": None, "phone": None},
            prefer="return=representation",
        )
        if status not in {200, 201} or not isinstance(companies, list) or not companies:
            raise VerificationError(
                f"Concurrent test company {worker_index} could not be created."
            )
        company_id = str(companies[0]["id"])
        company_ids.add(company_id)
        return company_id, name

    def upsert_worker(worker_index: int) -> tuple[str, str]:
        company_id, name = create_company(worker_index)
        expected_sales = Decimal(str(100 * (worker_index + 1)))
        payload = [
            {
                "company_id": company_id,
                "tally_voucher_id": f"{TEST_MARKER}-CONCURRENT-{worker_index}-SALES",
                "voucher_number": f"E2E-CONCURRENT-{worker_index}",
                "voucher_type": "sales",
                "date": "2026-10-15",
                "voucher_date": "2026-10-15",
                "party_name": f"{name} Customer",
                "narration": f"{TEST_MARKER} concurrent sales",
                "total_amount": str(expected_sales),
                "amount": str(expected_sales),
                "sales_amount": str(expected_sales),
                "purchase_amount": "0",
                "expense_amount": "0",
                "cgst_amount": "0",
                "sgst_amount": "0",
                "igst_amount": "0",
                "raw_ledger_entries": [],
            }
        ]
        rest_request(
            "POST",
            "/rest/v1/vouchers",
            payload=payload,
            prefer="resolution=merge-duplicates,return=representation",
        )
        company_totals[company_id] = expected_sales
        return company_id, name

    try:
        with ThreadPoolExecutor(max_workers=6) as executor:
            results = list(executor.map(upsert_worker, range(6)))
        for company_id, _ in results:
            rows = get_rows(
                "vouchers",
                {
                    "select": "id,company_id,tally_voucher_id,sales_amount",
                    "company_id": f"eq.{company_id}",
                    "limit": "100",
                },
            )
            if len(rows) != 1:
                raise VerificationError(
                    f"Concurrent company {company_id} did not retain exactly one voucher."
                )
            if any(str(row.get("company_id")) != company_id for row in rows):
                raise VerificationError(
                    f"Cross-company voucher merging detected for {company_id}."
                )
            summaries = get_rows(
                "financial_summaries",
                {
                    "select": "company_id,total_sales",
                    "company_id": f"eq.{company_id}",
                    "period_start": "eq.2026-10-01",
                    "limit": "10",
                },
            )
            if len(summaries) != 1:
                raise VerificationError(
                    f"Concurrent summary was missing for company {company_id}."
                )
            actual_sales = decimal_value(summaries[0]["total_sales"])
            if actual_sales != company_totals[company_id]:
                raise VerificationError(
                    f"Concurrent summary collision for {company_id}: "
                    f"expected {company_totals[company_id]}, found {actual_sales}."
                )
        print(
            "[SUCCESS] Multi-company concurrent verification passed:",
            f"{len(results)} isolated companies.",
        )
    finally:
        cleanup_test_data(company_ids=company_ids)
        assert_zero_test_residue(company_ids)
    return company_totals


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Verify the FINORA Supabase pipeline and synthetic data cleanup."
    )
    parser.add_argument(
        "--concurrency-test",
        action="store_true",
        help="run the multi-company concurrent upsert check only",
    )
    arguments = parser.parse_args(argv)
    company_id = ""
    created_auth_user_ids: set[str] = set()
    exit_code = 0
    try:
        initial_cleanup = cleanup_test_data()
        print(
            "[INFO] Initial test-data cleanup complete.",
        )

        if arguments.concurrency_test:
            run_multi_company_concurrency_check()
            print("[SUCCESS] Concurrency-only verification passed.")
            return 0

        missing_tables = [
            table
            for table in (
                "companies",
                "company_employees",
                "employee_work_logs",
                "vouchers",
                "financial_summaries",
                "audit_logs",
            )
            if not table_exists(table)
        ]
        if missing_tables:
            raise VerificationError(
                "Required pipeline tables are missing: " + ", ".join(missing_tables)
            )

        run_multi_company_concurrency_check()

        status, companies = rest_request(
            "POST",
            "/rest/v1/companies",
            payload={
                "name": f"{TEST_MARKER} Corp",
                "gstin": None,
                "email": None,
                "phone": None,
            },
            prefer="return=representation",
        )
        if status not in {200, 201} or not isinstance(companies, list) or not companies:
            raise VerificationError("Synthetic test company creation failed.")
        company_id = str(companies[0]["id"])

        voucher_payloads = [
            {
                "tally_voucher_id": f"{TEST_MARKER}-SALES-001",
                "voucher_number": "E2E-SALES-001",
                "voucher_type": "sales",
                "date": "2026-10-15",
                "voucher_date": "2026-10-15",
                "party_name": f"{TEST_MARKER} Customer",
                "narration": f"{TEST_MARKER} sales voucher",
                "total_amount": "118.00",
                "amount": "118.00",
                "sales_amount": "100.00",
                "purchase_amount": "0.00",
                "expense_amount": "0.00",
                "cgst_amount": "9.00",
                "sgst_amount": "9.00",
                "igst_amount": "0.00",
            },
            {
                "tally_voucher_id": f"{TEST_MARKER}-PURCHASE-001",
                "voucher_number": "E2E-PURCHASE-001",
                "voucher_type": "purchase",
                "date": "2026-10-20",
                "voucher_date": "2026-10-20",
                "party_name": f"{TEST_MARKER} Vendor",
                "narration": f"{TEST_MARKER} purchase voucher",
                "total_amount": "236.00",
                "amount": "236.00",
                "sales_amount": "0.00",
                "purchase_amount": "200.00",
                "expense_amount": "0.00",
                "cgst_amount": "18.00",
                "sgst_amount": "18.00",
                "igst_amount": "0.00",
            },
            {
                "tally_voucher_id": f"{TEST_MARKER}-PAYMENT-001",
                "voucher_number": "E2E-PAYMENT-001",
                "voucher_type": "payment",
                "date": "2026-10-21",
                "voucher_date": "2026-10-21",
                "party_name": f"{TEST_MARKER} Vendor",
                "narration": f"{TEST_MARKER} expense payment",
                "total_amount": "50.00",
                "amount": "50.00",
                "sales_amount": "0.00",
                "purchase_amount": "0.00",
                "expense_amount": "50.00",
                "cgst_amount": "0.00",
                "sgst_amount": "0.00",
                "igst_amount": "0.00",
            },
        ]

        rest_request(
            "POST",
            "/rest/v1/vouchers",
            payload=[
                {"company_id": company_id, **payload}
                for payload in voucher_payloads
            ],
            prefer="return=representation",
        )

        employee_id, work_log_id = create_employee_profile_and_work_log(
            company_id,
            created_auth_user_ids,
        )

        work_logs = get_rows(
            "employee_work_logs",
            {"select": "*", "id": f"eq.{work_log_id}", "limit": "1"},
        )
        if not work_logs:
            raise VerificationError("Synthetic employee work-log row was not found.")
        work_log_row = work_logs[0]
        if not work_log_row.get("completed_tasks"):
            raise VerificationError(
                "The employee work-log completed_tasks column did not persist."
            )
        for column in ("pending_work", "pending_tasks"):
            if not work_log_row.get(column):
                raise VerificationError(
                    f"The employee work-log {column} column did not persist."
                )

        audit_payload: dict[str, Any] = {
            "action": "e2e_verification",
            "details": {"company_id": company_id, "marker": TEST_MARKER},
        }
        if column_exists("audit_logs", "entity_type"):
            audit_payload["entity_type"] = "pipeline"
        if column_exists("audit_logs", "entity_id"):
            audit_payload["entity_id"] = f"{TEST_MARKER}-PIPELINE"
        audit_status, audit_rows = rest_request(
            "POST",
            "/rest/v1/audit_logs",
            payload=audit_payload,
            prefer="return=representation",
        )
        if (
            audit_status not in {200, 201}
            or not isinstance(audit_rows, list)
            or not audit_rows
        ):
            raise VerificationError("Synthetic audit event creation failed.")

        summary_columns = [
            "period_start",
            "period_end",
            "total_sales",
            "total_purchases",
            "total_expenses",
            "net_profit",
        ]
        gst_summary_columns = [
            "gst_payable",
            "gst_input",
            "cgst_payable",
            "sgst_payable",
            "igst_payable",
            "cgst_amount",
            "sgst_amount",
            "igst_amount",
        ]
        summary_columns.extend(
            column
            for column in gst_summary_columns
            if column_exists("financial_summaries", column)
        )
        summaries = get_rows(
            "financial_summaries",
            {
                "select": ",".join(summary_columns),
                "company_id": f"eq.{company_id}",
                "limit": "100",
            },
        )
        if len(summaries) != 1:
            raise VerificationError(
                "The voucher trigger did not create exactly one October 2026 financial summary."
            )
        summary = summaries[0]
        sales = decimal_value(summary["total_sales"])
        purchases = decimal_value(summary["total_purchases"])
        expenses = decimal_value(summary["total_expenses"])
        net_profit = decimal_value(summary["net_profit"])
        gst_payable = decimal_value(summary.get("gst_payable"))
        gst_input = decimal_value(summary.get("gst_input"))
        if gst_input == Decimal("0"):
            gst_input = (
                decimal_value(summary.get("cgst_payable"))
                + decimal_value(summary.get("sgst_payable"))
                + decimal_value(summary.get("igst_payable"))
            )
            if gst_input == Decimal("0"):
                gst_input = (
                    decimal_value(summary.get("cgst_amount"))
                    + decimal_value(summary.get("sgst_amount"))
                    + decimal_value(summary.get("igst_amount"))
                )
        if sales != Decimal("100.00"):
            raise VerificationError(f"Expected sales 100.00, found {sales}.")
        if purchases != Decimal("200.00"):
            raise VerificationError(f"Expected purchases 200.00, found {purchases}.")
        if expenses != Decimal("50.00"):
            raise VerificationError(f"Expected expenses 50.00, found {expenses}.")
        if net_profit != sales - purchases - expenses:
            raise VerificationError(
                "Net profit formula did not resolve as sales - purchases - expenses."
            )
        vouchers_after_insert = get_rows(
            "vouchers",
            {"select": "*", "company_id": f"eq.{company_id}", "limit": "100"},
        )
        voucher_output_tax = Decimal("0")
        voucher_input_tax = Decimal("0")
        for voucher in vouchers_after_insert:
            cgst = decimal_value(voucher.get("cgst_amount"))
            sgst = decimal_value(voucher.get("sgst_amount"))
            igst = decimal_value(voucher.get("igst_amount"))
            if voucher.get("voucher_type") == "sales":
                voucher_output_tax += cgst + sgst + igst
            elif voucher.get("voucher_type") == "purchase":
                voucher_input_tax += cgst + sgst + igst
        if voucher_output_tax != Decimal("18.00"):
            raise VerificationError(
                f"Sales GST reconciliation failed: expected 18.00, found {voucher_output_tax}."
            )
        if voucher_input_tax != Decimal("36.00"):
            raise VerificationError(
                f"Purchase GST reconciliation failed: expected 36.00, found {voucher_input_tax}."
            )
        if voucher_output_tax - voucher_input_tax != Decimal("-18.00"):
            raise VerificationError("GST output minus input-tax reconciliation failed.")

        print(
            "[SUCCESS] E2E synthetic pipeline passed:",
            f"sales={sales}, purchases={purchases}, expenses={expenses},",
            f"net_profit={net_profit}, gst_output={voucher_output_tax},",
            f"gst_input={voucher_input_tax}, gst_net={voucher_output_tax - voucher_input_tax}",
            f"employee={employee_id}, work_log={work_log_id}",
        )
        print(f"[INFO] Initial cleanup count: {initial_cleanup}")
    except VerificationError as error:
        print(f"[ERROR] {error}", file=sys.stderr)
        exit_code = 1
    finally:
        try:
            cleanup = cleanup_test_data(
                company_ids={company_id} if company_id else None,
                auth_user_ids=created_auth_user_ids,
            )
            print(f"[INFO] Mandatory cleanup complete: {cleanup}")
        except VerificationError as error:
            print(
                f"[ERROR] Mandatory cleanup could not complete: {error}",
                file=sys.stderr,
            )
            exit_code = 1
        try:
            residue = assert_zero_test_residue(
                {company_id} if company_id else None
            )
            print(f"[SUCCESS] Post-cleanup integrity assertion passed: {residue}")
        except VerificationError as error:
            print(f"[ERROR] {error}", file=sys.stderr)
            exit_code = 1
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
