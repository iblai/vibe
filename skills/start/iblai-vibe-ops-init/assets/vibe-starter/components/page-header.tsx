import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The house page header: title (and count) on the left, actions on the right, an optional toolbar row below. */
export function PageHeader({
  icon,
  title,
  count,
  description,
  actions,
  toolbar,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  count?: number | null;
  description?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("shrink-0 border-b border-[var(--border-color,#e5e7eb)] bg-white", className)}>
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-4 py-2.5 md:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon ? (
            <span className="flex size-8 items-center justify-center rounded-lg bg-[#eef6fc] text-[#0058cc] [&_svg]:size-4">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <span className="truncate">{title}</span>
              {typeof count === "number" ? (
                <span className="rounded-full bg-gray-100 px-2 py-px text-xs font-medium text-gray-600">{count}</span>
              ) : null}
            </h1>
            {description ? <p className="truncate text-xs text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {toolbar ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-4 py-2 md:px-6">{toolbar}</div>
      ) : null}
    </div>
  );
}
