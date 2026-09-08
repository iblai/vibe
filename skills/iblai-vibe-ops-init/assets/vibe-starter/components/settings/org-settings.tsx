"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrgSettings } from "@/lib/iblai/metadata";

/**
 * Custom org-level settings for THIS app, stored in the org's metadata under
 * `apps.<slug>` (GET-merge-PUT, so the OS's own settings are never dropped).
 * Add fields to OrgSettings in lib/iblai/metadata.ts and to this form.
 */
export function OrgSettingsForm() {
  const { settings, update, isLoading, isSaving } = useOrgSettings();
  const [appName, setAppName] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [supportUrl, setSupportUrl] = useState("");

  useEffect(() => {
    setAppName(settings.appName ?? "");
    setWelcomeMessage(settings.welcomeMessage ?? "");
    setSupportUrl(settings.supportUrl ?? "");
  }, [settings.appName, settings.welcomeMessage, settings.supportUrl]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update({ appName, welcomeMessage, supportUrl });
      toast.success("Organization settings saved");
    } catch (err) {
      toast.error(
        (err as { data?: { error?: string } })?.data?.error ??
          "Could not save — only organization admins can change these.",
      );
    }
  };

  return (
    <Card className="mx-4 my-6 md:mx-8">
      <CardHeader>
        <CardTitle>App settings</CardTitle>
        <CardDescription>
          Settings that apply to everyone in this organization. Stored on the
          platform, shared by every device.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid max-w-lg gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="app-name">App name</Label>
            <Input id="app-name" value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="Acme Support" disabled={isLoading} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="welcome">Welcome message</Label>
            <Input id="welcome" value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} placeholder="Shown to members on their first visit" disabled={isLoading} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="support-url">Support URL</Label>
            <Input id="support-url" type="url" value={supportUrl} onChange={(e) => setSupportUrl(e.target.value)} placeholder="https://help.example.com" disabled={isLoading} />
          </div>
          <div>
            <button
              type="submit"
              disabled={isLoading || isSaving}
              className="rounded-lg bg-gradient-to-r from-[#2563EB] to-[#93C5FD] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
