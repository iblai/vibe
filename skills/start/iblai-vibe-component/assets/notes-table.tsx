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
