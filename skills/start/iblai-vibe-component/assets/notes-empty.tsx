import Link from "next/link";
import { StickyNote } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export function NotesEmpty() {
  return (
    <EmptyState
      icon={<StickyNote strokeWidth={1.75} />}
      title="No notes yet"
      description="Notes you write show up here, newest first."
      action={
        <Link href="/notes/new" className="ibl-button-primary inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium">
          Write the first note
        </Link>
      }
    />
  );
}
