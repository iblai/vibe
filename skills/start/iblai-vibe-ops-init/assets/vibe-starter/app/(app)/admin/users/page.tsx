"use client";

import { useState } from "react";
import { InviteUserDialog, InvitedUsersDialog } from "@iblai/iblai-js/web-containers";
import { AccountPanel } from "@/components/admin/account-panel";
import { PageHeader } from "@/components/page-header";
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
      <PageHeader
        title="Users"
        actions={
          <>
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
              className="ibl-button-primary rounded-lg px-3 py-1.5 text-sm font-medium"
            >
              Invite user
            </button>
          </>
        }
      />
      <AccountPanel tab="management" onInviteClick={() => setShowInvite(true)} />
      <InviteUserDialog isOpen={showInvite} onClose={() => setShowInvite(false)} tenant={tenant} />
      {showPending && <InvitedUsersDialog onClose={() => setShowPending(false)} tenant={tenant} />}
    </>
  );
}
