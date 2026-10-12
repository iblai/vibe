"use client";

import { Plus, StickyNote } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export default function NotesPage() {
  return (
    <>
      <PageHeader
        icon={<StickyNote strokeWidth={1.75} />}
        title="Notes"
        count={12}
        description="Everything the team wrote down this week."
        actions={
          <button type="button" className="ibl-button-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium">
            <Plus className="size-4" strokeWidth={1.75} /> New note
          </button>
        }
      />
      <div className="flex-1 overflow-auto px-4 py-4 md:px-6">{/* the page */}</div>
    </>
  );
}
