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
