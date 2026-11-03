"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Org admins can view the app exactly as a member sees it (the OS's *learner
 * mode*). The (app) layout owns the state: default Admin, not persisted, reset
 * on reload. It is a *view* preference only — anything that must stay
 * admin-only regardless of the switch keys on `isTenantAdmin()`.
 */
type AdminMode = {
  /** The user administers the org (independent of the switch). */
  isAdmin: boolean;
  /** Admin *and* currently viewing in Admin mode. Gate admin UI on this. */
  adminMode: boolean;
  setAdminMode: (on: boolean) => void;
};

const AdminModeContext = createContext<AdminMode>({
  isAdmin: false,
  adminMode: false,
  setAdminMode: () => {},
});

export function AdminModeProvider({
  isAdmin,
  mode,
  setMode,
  children,
}: {
  isAdmin: boolean;
  mode: boolean;
  setMode: (on: boolean) => void;
  children: ReactNode;
}) {
  return (
    <AdminModeContext.Provider
      value={{ isAdmin, adminMode: isAdmin && mode, setAdminMode: setMode }}
    >
      {children}
    </AdminModeContext.Provider>
  );
}

export function useAdminMode() {
  return useContext(AdminModeContext);
}
