export type UserRole = "admin" | "employee" | "company";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at?: string;
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
