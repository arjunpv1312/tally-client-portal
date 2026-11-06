"use client";

export type SelectableCompany = {
  id: string;
  name: string;
};

type CompanySelectorProps = {
  companies: SelectableCompany[];
  value: string;
  onChange: (companyId: string) => void;
};

export function CompanySelector({
  companies,
  value,
  onChange,
}: CompanySelectorProps) {
  if (companies.length < 2) return null;

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Active company</span>
      <select
        aria-label="Active company"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 max-w-48 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:max-w-60 sm:px-3"
      >
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
    </label>
  );
}
