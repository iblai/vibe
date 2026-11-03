"use client";

import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserSettings } from "@/lib/iblai/metadata";

/**
 * Per-user settings for THIS app, stored on the platform under the user's
 * metadata (`apps.<slug>`) — they follow the user to every device and never
 * touch localStorage. Add fields to UserSettings in lib/iblai/metadata.ts.
 */
export function AppPreferences() {
  const { settings, update, isLoading, isSaving } = useUserSettings();

  const save = async (patch: Parameters<typeof update>[0]) => {
    try {
      await update(patch);
      toast.success("Preferences saved");
    } catch {
      toast.error("Could not save preferences");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>App preferences</CardTitle>
        <CardDescription>Yours alone; saved to your ibl.ai profile for this organization.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center justify-between gap-4 text-sm">
          <label htmlFor="pref-theme">
            <span className="font-medium">Dark theme</span>
            <span className="block text-xs text-muted-foreground">Example preference — wire it to your theme provider.</span>
          </label>
          <Switch
            id="pref-theme"
            checked={settings.theme === "dark"}
            disabled={isLoading || isSaving}
            onCheckedChange={(on: boolean) => void save({ theme: on ? "dark" : "light" })}
          />
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <label htmlFor="pref-onboarding">
            <span className="font-medium">Onboarding done</span>
            <span className="block text-xs text-muted-foreground">Example flag — an onboarding flow would set this on its last step.</span>
          </label>
          <Switch
            id="pref-onboarding"
            checked={!!settings.onboardingDone}
            disabled={isLoading || isSaving}
            onCheckedChange={(on: boolean) => void save({ onboardingDone: on })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
