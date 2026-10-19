import type { LoginRoleTab, UserRole } from "@/types";

export function tabToExpectedRole(tab: LoginRoleTab): UserRole {
  if (tab === "client") return "company";
  return tab;
}

export function redirectPathForRole(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "employee":
      return "/employee";
    case "company":
      return "/dashboard";
  }
}
