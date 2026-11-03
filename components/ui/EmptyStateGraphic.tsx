import { FileChartColumnIncreasing } from "lucide-react";

type EmptyStateGraphicProps = {
  title: string;
  description: string;
};

export function EmptyStateGraphic({
  title,
  description,
}: EmptyStateGraphicProps) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600 dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#60A5FA]"
        aria-hidden="true"
      >
        <FileChartColumnIncreasing className="h-8 w-8" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}
