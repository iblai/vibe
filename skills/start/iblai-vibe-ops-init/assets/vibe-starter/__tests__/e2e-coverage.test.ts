import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { check, MIN_PER_KLOC, THRESHOLD } from "../e2e/coverage.mjs";

/** e2e/coverage.mjs — the starter passes its own gate, and a page nobody visits is named. */
const root = fileURLToPath(new URL("..", import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-coverage-"));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

function write(file: string, text: string) {
  fs.mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true });
  fs.writeFileSync(path.join(tmp, file), text);
}

describe("pnpm e2e:coverage", () => {
  // Not in the render gate's scratch (SKILL_RENDER): a skill's overlay adds pages no starter journey visits.
  it.skipIf(!!process.env.SKILL_RENDER)(
    "passes on the starter: no ledger error, every page visited, above the threshold",
    () => {
      const r = check(root);
      expect(r.errors).toEqual([]);
      expect(r.pagesVisited).toBe(r.pages);
      expect(r.percent).toBeGreaterThanOrEqual(THRESHOLD);
      expect(r.perKloc).toBeGreaterThanOrEqual(MIN_PER_KLOC);
    },
  );

  it("refuses a thin suite: one checkpoint for a thousand app lines", () => {
    const thin = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-thin-"));
    const put = (file: string, text: string) => {
      fs.mkdirSync(path.dirname(path.join(thin, file)), { recursive: true });
      fs.writeFileSync(path.join(thin, file), text);
    };
    put(
      "app/page.tsx",
      "export default function Page() { return null; }\n" +
        "// filler\n".repeat(999),
    );
    put(
      "e2e/journeys/home.journey.spec.ts",
      "test('H1 · home renders', async ({ page }) => { await page.goto('/'); });\n",
    );
    put("e2e/COVERAGE.md", "| H1 | home renders |\n");
    put(
      "e2e/coverage.json",
      JSON.stringify({
        version: 2,
        summary: { totalCheckpoints: 1, totalJourneys: 1 },
        journeys: [
          {
            id: "home",
            spec: "journeys/home.journey.spec.ts",
            sourceFiles: ["app/page.tsx"],
            checkpoints: [{ id: "H1", name: "home renders" }],
          },
        ],
      }),
    );
    const r = check(thin);
    fs.rmSync(thin, { recursive: true, force: true });
    expect(r.percent).toBe(100);
    expect(r.errors).toEqual([
      expect.stringMatching(
        /^checkpoints per 1,000 app lines: 1\.0 \(1 for 100[01] lines; floor 6\)/,
      ),
    ]);
  });

  it("names the page no journey visits and the file only it reaches", () => {
    write(
      "app/a/page.tsx",
      'import { A } from "@/components/a";\nexport default A;\n',
    );
    write(
      "app/b/page.tsx",
      'import { B } from "@/components/b";\nexport default B;\n',
    );
    write("components/a.tsx", "export const A = () => null;\n");
    write("components/b.tsx", "export const B = () => null;\n");
    write(
      "e2e/journeys/a.journey.spec.ts",
      "test('X1 · a renders', async ({ page }) => { await page.goto('/a'); });\n",
    );
    write("e2e/COVERAGE.md", "| X1 | a renders |\n");
    write(
      "e2e/coverage.json",
      JSON.stringify({
        version: 2,
        summary: { totalCheckpoints: 1, totalJourneys: 1 },
        journeys: [
          {
            id: "a",
            spec: "journeys/a.journey.spec.ts",
            sourceFiles: ["app/a/page.tsx"],
            checkpoints: [{ id: "X1", name: "a renders" }],
          },
        ],
      }),
    );
    const r = check(tmp);
    expect(r.errors).toEqual(["app/b/page.tsx (/b) is visited by no journey"]);
    expect(r.unreached.map((u) => u.file).sort()).toEqual([
      "app/b/page.tsx",
      "components/b.tsx",
    ]);
    expect(r.unreached.find((u) => u.file === "components/b.tsx")?.why).toBe(
      "imported by app/b/page.tsx — no journey visits /b",
    );
    expect(r.percent).toBe(50);
  });
});
