export type UserRole = "admin" | "employee" | "company";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at?: string;
}

export interface Company {
  id: string;
  name: string;
  gstin: string | null;
  email?: string | null;
  phone?: string | null;
  created_at?: string;
}

export interface EmployeeCompanyAssignment {
  id: string;
  employee_id: string;
  company_id: string;
  entry_status: "pending" | "in_progress" | "complete";
  company?: Company;
}

export interface VoucherSummary {
  period: string;
  sales: number;
  expenses: number;
  net_profit: number;
  gst_payable: number;
  gst_input: number;
}

export type LoginRoleTab = "admin" | "employee" | "client";
