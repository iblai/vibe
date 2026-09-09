"use client";

import { Spinner } from "@iblai/iblai-js/web-containers";
import { cn } from "@/lib/utils";

/**
 * The one loading / busy screen, the OS's look: white, a centred Lucide arc in
 * brand blue. Full page by default; `overlay` covers the viewport (opaque,
 * above everything, like the OS boot loader) while something saves or
 * redirects and the user must not interact. Busy forms keep their controls
 * disabled underneath it as well.
 */
export function LoadingScreen({
  message,
  overlay = false,
  className,
}: {
  message?: string;
  /** Cover the viewport and block interaction while something saves or redirects. */
  overlay?: boolean;
  className?: string;
}) {
  return (
    <output
      aria-live="polite"
      aria-label={message ?? "Loading"}
      className={cn(
        "flex flex-col items-center justify-center gap-4 bg-white",
        overlay ? "fixed inset-0 z-[9999]" : "min-h-screen w-full",
        className,
      )}
    >
      <Spinner className="h-14 w-14 text-[#2563EB]" />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </output>
  );
}
