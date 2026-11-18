#!/usr/bin/env python3
"""Isolated FINORA Supabase pipeline verification with mandatory cleanup."""

from __future__ import annotations

import json
import os
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request
from decimal import Decimal
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
TEST_MARKER = "__FINORA_E2E_TEST__"


class VerificationError(RuntimeError):
    pass


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
    except urllib.error.URLError as error:
        raise VerificationError(
            f"Unable to reach Supabase REST API: {error.reason}"
        ) from error


def table_exists(table: str) -> bool:
    try:
        rest_request("GET", f"/rest/v1/{table}", query={"select": "*", "limit": "1"})
        return True
    except VerificationError as error:
        if "HTTP 404" in str(error) or "PGRST205" in str(error):
            return False
        raise


def get_rows(table: str, query: dict[str, str]) -> list[dict[str, Any]]:
    _status, data = rest_request(
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
        "audit_logs": 0,
        "auth_users": 0,
    }
    target_ids = set(company_ids or set())

    companies = get_rows(
        "companies",
        {"select": "id,name", "name": "ilike.*TEST*", "limit": "1000"},
    )
    marker_companies = [
        row
        for row in companies
        if TEST_MARKER in str(row.get("name", ""))
        or "TEST_" in str(row.get("name", "")).upper()
        or "TEST" in str(row.get("name", "")).upper()
    ]
    for row in marker_companies:
        target_ids.add(str(row["id"]))

    if table_exists("vouchers"):
        all_vouchers = get_rows(
            "vouchers",
            {"select": "id,tally_voucher_id,company_id", "limit": "10000"},
        )
        for row in all_vouchers:
            tally_id = str(row.get("tally_voucher_id", "")).upper()
            company_id = str(row.get("company_id", ""))
            if (
                TEST_MARKER in tally_id
                or tally_id.startswith("TEST_BATCH_")
                or tally_id.startswith("TEST_PURCHASE_")
                or TEST_MARKER in tally_id
                or company_id in target_ids
            ):
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
        audit_rows = get_rows(
            "audit_logs",
            {"select": "id,details,entity_id", "limit": "10000"},
        )
        for row in audit_rows:
            details = row.get("details")
            if not isinstance(details, dict):
                continue
            company_id = str(details.get("company_id", ""))
            entity_id = str(row.get("entity_id", ""))
            if company_id in target_ids or TEST_MARKER in entity_id:
                delete_rows("audit_logs", {"id": f"eq.{row['id']}"})
                counts["audit_logs"] += 1

    for company_id in target_ids:
        delete_rows("companies", {"id": f"eq.{company_id}"})
        counts["companies"] += 1

    for auth_user_id in auth_user_ids or set():
        status, _ = rest_request(
            "DELETE",
            f"/auth/v1/admin/users/{auth_user_id}",
        )
        if status in {200, 204}:
            counts["auth_users"] += 1

    return counts


def assert_zero_test_residue() -> dict[str, int]:
    residue = {
        "companies": 0,
        "vouchers": 0,
        "financial_summaries": 0,
        "employee_work_logs": 0,
        "audit_logs": 0,
    }

    companies = get_rows(
        "companies",
        {"select": "id,name", "limit": "10000"},
    )
    residue["companies"] = sum(
        1
        for row in companies
        if "TEST" in str(row.get("name", "")).upper()
        or TEST_MARKER in str(row.get("name", ""))
    )

    if table_exists("vouchers"):
        vouchers = get_rows(
            "vouchers",
            {"select": "id,tally_voucher_id", "limit": "10000"},
        )
        residue["vouchers"] = sum(
            1
            for row in vouchers
            if "TEST" in str(row.get("tally_voucher_id", "")).upper()
            or TEST_MARKER in str(row.get("tally_voucher_id", ""))
        )

    if table_exists("financial_summaries"):
        summaries = get_rows(
            "financial_summaries",
            {"select": "id,company_id", "limit": "10000"},
        )
        residue["financial_summaries"] = sum(
            1
            for row in summaries
            if str(row.get("company_id", "")) in {
                str(company_id)
                for company_id in [
                    row2.get("id")
                    for row2 in companies
                    if "TEST" in str(row2.get("name", "")).upper()
                ]
            }
        )

    if table_exists("employee_work_logs"):
        work_logs = get_rows(
            "employee_work_logs",
            {"select": "id,completed_tasks,pending_work,pending_tasks", "limit": "10000"},
        )
        residue["employee_work_logs"] = sum(
            1
            for row in work_logs
            if any(
                TEST_MARKER in str(value)
                for key in ("completed_tasks", "pending_work", "pending_tasks")
                for value in (
                    row.get(key)
                    if isinstance(row.get(key), list)
                    else [row.get(key)]
                )
                if value is not None
            )
        )

    if table_exists("audit_logs"):
        audit_logs = get_rows(
            "audit_logs",
            {"select": "id,details,entity_id", "limit": "10000"},
        )
        residue["audit_logs"] = sum(
            1
            for row in audit_logs
            if TEST_MARKER in str(row.get("entity_id", ""))
            or TEST_MARKER in json.dumps(row.get("details", {}))
        )

    if any(residue.values()):
        raise VerificationError(
            f"Test data residue remains after cleanup: {residue}"
        )
    return residue


def create_employee_profile_and_work_log(company_id: str) -> tuple[str, str, str]:
    profiles = get_rows(
        "profiles",
        {"select": "id,email,role", "role": "eq.employee", "limit": "1"},
    )
    created_auth_user_id: str | None = None
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
        created_auth_user_id = employee_id
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

    rest_request(
        "POST",
        "/rest/v1/company_employees",
        payload={
            "employee_id": employee_id,
            "company_id": company_id,
            "entry_status": "pending",
        },
        prefer="resolution=merge-duplicates,return=representation",
    )
    status, work_logs = rest_request(
        "POST",
        "/rest/v1/employee_work_logs",
        payload={
            "user_id": employee_id,
            "company_id": company_id,
            "completed_tasks": [f"{TEST_MARKER} completed"],
            "pending_work": [f"{TEST_MARKER} pending"],
            "pending_tasks": [f"{TEST_MARKER} pending"],
        },
        prefer="return=representation",
    )
    if status not in {200, 201} or not isinstance(work_logs, list) or not work_logs:
        raise VerificationError("Employee work-log verification did not return a row.")
    work_log = work_logs[0]
    return employee_id, str(work_log["id"]), created_auth_user_id or ""


def main() -> int:
    company_id = ""
    created_auth_user_ids: set[str] = set()
    try:
        initial_cleanup = cleanup_test_data()
        print(
            "[INFO] Initial test-data cleanup complete.",
        )

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

        employee_id, work_log_id, created_auth_user_id = (
            create_employee_profile_and_work_log(company_id)
        )
        if created_auth_user_id:
            created_auth_user_ids.add(created_auth_user_id)

        work_logs = get_rows(
            "employee_work_logs",
            {"select": "id,completed_tasks,pending_work,pending_tasks", "id": f"eq.{work_log_id}", "limit": "1"},
        )
        if not work_logs:
            raise VerificationError("Synthetic employee work-log row was not found.")
        work_log_row = work_logs[0]
        if not work_log_row.get("completed_tasks") or not (
            work_log_row.get("pending_tasks")
            or work_log_row.get("pending_work")
        ):
            raise VerificationError(
                "Employee work-log pending/completed task columns did not persist."
            )

        rest_request(
            "POST",
            "/rest/v1/audit_logs",
            payload={
                "action": "e2e_verification",
                "entity_type": "pipeline",
                "entity_id": f"{TEST_MARKER}-PIPELINE",
                "details": {"company_id": company_id, "marker": TEST_MARKER},
            },
            prefer="return=representation",
        )

        summaries = get_rows(
            "financial_summaries",
            {
                "select": "period_start,period_end,total_sales,total_purchases,total_expenses,net_profit,gst_payable,gst_input",
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
        gst_payable = decimal_value(summary["gst_payable"])
        gst_input = decimal_value(summary["gst_input"])
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
        if gst_payable != Decimal("18.00") or gst_input != Decimal("36.00"):
            raise VerificationError(
                "GST trigger totals do not reconcile with synthesized voucher taxes."
            )
        if gst_payable - gst_input != Decimal("-18.00"):
            raise VerificationError("GST output minus input-tax reconciliation failed.")

        print(
            "[SUCCESS] E2E synthetic pipeline passed:",
            f"sales={sales}, purchases={purchases}, expenses={expenses},",
            f"net_profit={net_profit}, gst_net={gst_payable - gst_input}",
            f"employee={employee_id}, work_log={work_log_id}",
        )
        print(f"[INFO] Initial cleanup count: {initial_cleanup}")
        return 0
    except VerificationError as error:
        print(f"[ERROR] {error}", file=sys.stderr)
        return 1
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
        try:
            residue = assert_zero_test_residue()
            print(f"[SUCCESS] Post-cleanup integrity assertion passed: {residue}")
        except VerificationError as error:
            print(f"[ERROR] {error}", file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())
