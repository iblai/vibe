import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, join } from "path";

/**
 * The house shell (BRAND.md → Shell): the top bar in the OS's type — 64 px at
 * every width, the `#D0E0FF` hairline, the system font scoped to the bar — over
 * an Open Sans page, and Lucide at 1.75 through one rule. The boot smoke cannot
 * see the bar (the SDK AuthProvider holds the shell behind sign-in), so this
 * guards the source.
 */

const projectRoot = resolve(__dirname, "..");
const read = (file: string) => readFileSync(join(projectRoot, file), "utf-8");

describe("house shell", () => {
  it("the top bar is the OS's: 64 px, the hairline, the system font", () => {
    const header =
      /<header className="([^"]+)"/.exec(read("components/navbar/nav-bar.tsx"))?.[1] ?? "";
    expect(header).toContain("h-16");
    expect(header).not.toMatch(/md:h-/);
    expect(header).toContain("border-[var(--navbar-border,#D0E0FF)]");
    expect(header).toContain("font-[ui-sans-serif,system-ui,sans-serif]");
  });

  it("the navbar variables carry the OS's greys over an Open Sans page", () => {
    const css = read("app/globals.css");
    expect(css).toContain("--navbar-text: #646464;");
    expect(css).toContain("--navbar-hover-text: #484848;");
    expect(css).toContain("--navbar-border: #D0E0FF;");
    expect(css).toMatch(/--font-sans:\s*var\(--font-open-sans\)/);
    expect(css).not.toMatch(/font-family[^;]*!important/);
    expect(read("app/iblai-styles.css")).not.toMatch(/font-family[^;]*!important/);
  });

  it("Lucide renders at 1.75 through one rule", () => {
    expect(read("app/globals.css")).toContain('.lucide[stroke-width="2"]');
  });
});
