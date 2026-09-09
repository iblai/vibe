"use client";

import { usePathname, useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { useAdminMode } from "@/lib/iblai/admin-mode";

/** User / Admin view switch for org admins. Renders nothing for members. */
export function AdminModeSwitch({ className }: { className?: string }) {
  const { isAdmin, adminMode, setAdminMode } = useAdminMode();
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  if (!isAdmin) return null;
  return (
    <div className={`flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] ${className ?? ""}`}>
      <span className={adminMode ? "" : "text-[var(--primary-color)]"}>User</span>
      <Switch
        id="admin-mode"
        checked={adminMode}
        onCheckedChange={(on: boolean) => {
          setAdminMode(on);
          // The admin area is admin-only; leaving Admin mode there goes home.
          if (!on && pathname.startsWith("/admin")) router.push("/");
        }}
        aria-label="Admin mode"
      />
      <span className={adminMode ? "text-[var(--primary-color)]" : ""}>Admin</span>
    </div>
  );
}
