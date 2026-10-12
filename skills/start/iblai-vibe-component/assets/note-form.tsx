"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NoteForm({ onSave, onCancel }: { onSave: (title: string) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const invalid = title.trim() === "";
  return (
    <form
      className="grid max-w-lg gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setTried(true);
        if (invalid) return;
        setSaving(true);
        await onSave(title.trim());
        setSaving(false);
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="note-title" className="text-gray-700">
          Title
        </Label>
        <Input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Standup, 12 Oct" aria-invalid={tried && invalid} />
        <p className="text-xs text-muted-foreground">Shown in the list and in the page header.</p>
        {tried && invalid ? <p className="text-xs text-red-500">A title is required.</p> : null}
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" className="ibl-button-primary" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
