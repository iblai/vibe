"use client";

import { useState } from "react";
import { InviteUserDialog, InvitedUsersDialog } from "@iblai/iblai-js/web-containers";
import { AccountPanel } from "@/components/admin/account-panel";
import { resolveAppTenant } from "@/lib/iblai/tenant";

/**
 * Users · Groups · Roles · Policies · Teams · Alerts — the SDK's Management
 * surface — plus invitations. Admin mode only (the (app) layout gates it).
 */
export default function AdminUsersPage() {
  const [showInvite, setShowInvite] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const tenant = resolveAppTenant();

  return (
    <>
      <div className="flex items-center justify-end gap-2 px-4 pt-4 md:px-8">
        <button
          type="button"
          onClick={() => setShowPending(true)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          Pending invites
        </button>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="rounded-lg bg-gradient-to-r from-[#2563EB] to-[#93C5FD] px-3 py-1.5 text-sm font-medium text-white"
        >
          Invite user
        </button>
      </div>
      <AccountPanel tab="management" onInviteClick={() => setShowInvite(true)} />
      <InviteUserDialog isOpen={showInvite} onClose={() => setShowInvite(false)} tenant={tenant} />
      {showPending && <InvitedUsersDialog onClose={() => setShowPending(false)} tenant={tenant} />}
    </>
  );
}
