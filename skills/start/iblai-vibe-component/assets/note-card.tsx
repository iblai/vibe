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
