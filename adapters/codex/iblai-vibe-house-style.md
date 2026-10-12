# iblai-vibe-house-style

> The ibl.ai house style for apps built on @iblai/iblai-js, with the canonical, typechecked snippets to check your UI against — Open Sans wired so it actually renders (semibold one step lighter), the type scale, the brand blue and the gradient CTA, and the common components (page header, empty state, loading screen, section card, form field, dialog footer, table, status badge, toast, the SDK shell). Use when the user says house style, design language, font, font size, Open Sans, off-brand, make it look like the OS, page header, empty state, loading screen or status badge, and before diverging from the ibl.ai look in any way: the rule is to stop and ask first.

# ibl.ai house style

What an ibl.ai app looks like, as code you can diff against. Every `tsx` fence
below typechecks against vibe-starter, and the two components it imports ship
in the starter (`components/page-header.tsx`, `components/empty-state.tsx`,
next to the existing `components/loading-screen.tsx`). Tokens and the full
palette: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md).

## The rule: ask before diverging

An app on `@iblai/iblai-js` (the dependency in `package.json`, or an
`iblai.env`) is an ibl.ai app, and this style is its design system. A
project with its own design system (a v0 import, a partner brand) keeps the
"project tokens win" rule of `/iblai-vibe-component`; everything else follows
this skill.

Before any of these, **stop and ask** with `AskUserQuestion`:

- another font face, or a different weight scale;
- a text size outside the scale below;
- a new accent colour (anything but `#0058cc`, its tint `#eef6fc`, the
  gradient CTA and Tailwind's greys);
- restyling an SDK component's internals;
- a hand-rolled or shadcn shell instead of the SDK sidebar;
- a bespoke spinner;
- a border or card around an SDK panel;
- dark mode.

The question states what the house style says, what would change, and what
it costs (a second visual language, an SDK panel that stops matching the
OS). Offer three options: keep the house style; diverge here only; change
the house style in BRAND.md. Never diverge silently, and never "fix" an
existing divergence the user did not ask about: report it, one line.

## Type

Open Sans, the variable font, weights 300–800, self-hosted by
`next/font/google`. Three steps make it render; skip one and the system
stack shows instead, with no error anywhere.

1. `app/layout.tsx`: load it and put the **variable on `<html>`**, where
   `--font-sans` is declared (a variable set on `<body>` is invisible to
   `:root`):

```tsx
import { Open_Sans } from "next/font/google";

const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-open-sans" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${openSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

2. `app/globals.css`: map it in `@theme inline`, so shadcn's `font-heading`
   and the SDK sidebar's `font-sans` pick it up too, one weight step lighter:

```css
@theme inline {
  --font-sans:
    var(--font-open-sans), ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji",
    "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
  --font-weight-semibold: 500;
  --font-weight-bold: 600;
  --font-heading: var(--font-sans);
}
```

3. Delete any `body { font-family: … !important }` rule. Older copies of
   `app/iblai-styles.css` carry one, and it beats whatever `next/font` loaded.

The scale, as the OS and the SDK use it:

| Role | Classes |
|---|---|
| Page title in a header bar | `text-base font-semibold text-gray-900` |
| Page title on a list page | `text-2xl font-semibold text-gray-700`, subtitle `text-sm text-gray-600` |
| Section or card title | `text-sm font-semibold text-gray-900` |
| Dialog title | `ibl-dialog-title` |
| Body | `text-sm` (`text-gray-700` on white) |
| Meta, help, timestamps | `text-xs text-muted-foreground` |
| Form label | `Label` (already `text-sm font-medium`), `text-gray-700` |
| Error | `text-xs text-red-500` |
| Table head | `text-[11px] font-semibold tracking-wide text-muted-foreground uppercase` |

`font-semibold` renders 500 and `font-bold` 600 through the remap; write
the classes as usual.

## Colour and surface

- Primary `#0058cc`; its tint `#eef6fc` for icon tiles and selected rows;
  the gradient CTA is `className="ibl-button-primary"` (from
  `app/iblai-styles.css`), paired with `variant="outline"` for cancel.
- Text and borders are Tailwind greys; cards and header bars are
  `bg-white` with `border-[var(--border-color,#e5e7eb)]`; the page surface
  is `bg-[var(--sidebar-bg,#fafbfc)]`.
- Lucide icons, `strokeWidth={1.75}`; a status dot is grey unless it means
  good or bad.
- The brand tokens come from `app/iblai-styles.css`. Never redeclare shadcn's
  neutral `:root` / `.dark` blocks after that import: they win, and
  `--primary` turns near-black.

## Common components

Reuse the three files first; the rest are recipes on the starter's own
primitives.

### Page header

`components/page-header.tsx` ships in the starter: title and optional count
on the left, actions on the right, an optional toolbar row. A page is the
header, then `flex-1 overflow-auto`.

`app/(app)/notes/page.tsx`

```tsx
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
```

### Empty state

`components/empty-state.tsx` ships in the starter: a dashed card, an icon
tile in the brand tint, a title, one line of help, one action.

`components/notes/notes-empty.tsx`

```tsx
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
```

### Loading

`components/loading-screen.tsx` ships in the starter: the OS arc, full page
or as an opaque overlay while something saves. No grey "Loading..." text, no
other spinner.

`app/(app)/notes/loading.tsx`

```tsx
import { LoadingScreen } from "@/components/loading-screen";

export default function Loading() {
  return <LoadingScreen />;
}

export function SavingOverlay() {
  return <LoadingScreen overlay message="Saving…" />;
}
```

### Section card

The starter's `Card` with the house border instead of its ring.

`components/notes/note-card.tsx`

```tsx
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function NoteCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="rounded-lg border border-[var(--border-color,#e5e7eb)] bg-white ring-0">
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-gray-900">{title}</CardTitle>
        <CardDescription className="text-xs">Updated today</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="text-sm text-gray-700">{body}</CardContent>
    </Card>
  );
}
```

### Form field and button pair

`Label` + `Input` + help, the error under it, the gradient CTA next to an
outline cancel. The typographic ellipsis in "Saving…".

`components/notes/note-form.tsx`

```tsx
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
```

### Dialog footer

The SDK `Spinner` inside the confirming button while the call is pending;
the title through `ibl-dialog-title`.

`components/notes/delete-note-dialog.tsx`

```tsx
"use client";

import { Spinner } from "@iblai/iblai-js/web-containers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function DeleteNoteDialog({
  open,
  pending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="ibl-dialog-title">Delete this note?</DialogTitle>
          <DialogDescription>It disappears for everyone in the organization. This cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button className="ibl-button-primary" onClick={onConfirm} disabled={pending}>
            {pending ? <Spinner size="sm" className="size-4 text-current" /> : null}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Table

A plain table in a bordered white box, as the OS and the LMS do it; add
shadcn's `table` (`pnpm dlx shadcn@latest add table`) only when you need
its sticky or responsive wrappers, with the same classes.

`components/notes/notes-table.tsx`

```tsx
export function NotesTable({ rows }: { rows: { id: string; title: string; words: number }[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border-color,#e5e7eb)] bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50/70 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2 text-right">Words</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="px-3 py-2 font-medium text-gray-900">{row.title}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.words}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Status badge

The starter's `Badge` with a dot. Grey by default; emerald and rose only
for good and bad; the brand tint for "open" or "selected".

`components/notes/note-status.tsx`

```tsx
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

const TONES = {
  neutral: { badge: "bg-gray-100 text-gray-600 ring-gray-500/20", dot: "bg-gray-400" },
  positive: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", dot: "bg-emerald-500" },
  negative: { badge: "bg-rose-50 text-rose-700 ring-rose-600/20", dot: "bg-rose-500" },
  brand: { badge: "bg-[#eef6fc] text-[#0058cc] ring-[#0058cc]/20", dot: "bg-[#0058cc]" },
} as const;

export function NoteStatus({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <Badge variant="outline" className={`gap-1.5 rounded-full border-transparent px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONES[tone].badge}`}>
      <span className={`size-1.5 rounded-full ${TONES[tone].dot}`} aria-hidden />
      {children}
    </Badge>
  );
}
```

### Toast, shell, navbar

- Toasts: `pnpm dlx shadcn@latest add sonner`, mount `<Toaster />` once in
  the root layout, then `toast.success("Saved")` / `toast.error(message)`.
- The shell of a sidebar app is the SDK's `SidebarProvider` →
  `PlatformSidebar` + `SidebarInset` from `@iblai/iblai-js/web-containers/next`,
  never a local shadcn sidebar copy (separate React contexts). The starter's
  top navbar: `/iblai-vibe-navbar`.
- SDK panels sit full width in a `flex-1 min-h-0` wrapper and own their
  scrolling; analytics full-bleed on its own `#f5f7fb`.

## Check

Read painted values, not the source: a loaded font and a mapped one look
the same in `layout.tsx`, and the minifier rewrites the `oklch()` token to
`lab()`, so the raw `--primary` is not stable either. In the browser
(production build, `pnpm build && pnpm start`), on a page that is still your
app (an unauthenticated route leaves for the sign-in site within seconds):

```js
const probe = (cls) => { const d = document.createElement("div"); d.className = cls; document.body.appendChild(d); const cs = getComputedStyle(d); d.remove(); return cs; };
getComputedStyle(document.body).fontFamily; // starts with "Open Sans"
probe("bg-primary").backgroundColor; // "rgb(0, 88, 204)"
probe("font-semibold").fontWeight; // "500"
```

vibe-starter's boot smoke (`scripts/boot-smoke/smoke.spec.ts` in the vibe
repo) asserts the same three on every CI run.

## Related skills

- `/iblai-vibe-component` — which SDK component covers a feature, and the
  layout patterns around it
- `/iblai-vibe-navbar` — the starter's navbar, logo, bell and profile menu
- `/iblai-vibe-design` — the design workflow (critique, polish, typeset) on
  top of this style
- `/iblai-vibe-ops-test` — build, test and screenshot before saying "done"