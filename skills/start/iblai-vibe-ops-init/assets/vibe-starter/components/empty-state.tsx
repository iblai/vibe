import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The house empty state: a dashed card with an optional icon tile, a title, one line of help and one action. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00b0ef]/15 to-[#0058cc]/15 text-[#0058cc] [&_svg]:size-6">
          {icon}
        </div>
      ) : null}
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
