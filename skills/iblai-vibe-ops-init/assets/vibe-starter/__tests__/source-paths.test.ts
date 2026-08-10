
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";

/**
 * Verify that every @source directive in CSS files points to an existing
 * directory (they reach into node_modules/@iblai/iblai-js/dist).
 *
 * If these paths break, Tailwind v4 silently stops generating utility
 * classes for SDK components — no build error, just missing styles.
 */

const projectRoot = resolve(__dirname, "..");
const nodeModulesExist = existsSync(join(projectRoot, "node_modules"));

// Detect src/ layout
const appDir = existsSync(join(projectRoot, "src", "app"))
  ? join(projectRoot, "src", "app")
  : join(projectRoot, "app");

describe.skipIf(!nodeModulesExist)("@source paths", () => {
  // Collect all CSS files in app/
  const cssFiles: string[] = [];
  if (existsSync(appDir)) {
    for (const file of readdirSync(appDir)) {
      if (file.endsWith(".css")) {
        cssFiles.push(join(appDir, file));
      }
    }
  }

  // Extract @source directives
  const sourceDirectives: { file: string; path: string; resolved: string }[] =
    [];
  for (const cssFile of cssFiles) {
    const content = readFileSync(cssFile, "utf-8");
    const regex = /@source\s+["']([^"']+)["']/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      sourceDirectives.push({
        file: cssFile,
        path: match[1],
        resolved: resolve(dirname(cssFile), match[1]),
      });
    }
  }

  it("should find at least one @source directive", () => {
    expect(sourceDirectives.length).toBeGreaterThan(0);
  });

  for (const { file, path: srcPath, resolved } of sourceDirectives) {
    const relFile = file.split(/[/\\]app[/\\]/).pop() ?? file;
    it(`@source "${srcPath}" in ${relFile} should resolve to an existing path`, () => {
      expect(
        existsSync(resolved),
        `Path does not exist: ${resolved}\n` +
          `Referenced in: ${file}\n` +
          `Hint: run pnpm install to populate node_modules`,
      ).toBe(true);
    });
  }
});

describe.skipIf(!nodeModulesExist)("SDK sources", () => {
  it("web-containers/source should contain compiled JS", () => {
    const sourceDir = join(
      projectRoot,
      "node_modules",
      "@iblai",
      "iblai-js",
      "dist",
      "web-containers",
      "source",
    );
    expect(existsSync(sourceDir)).toBe(true);
    const files = readdirSync(sourceDir);
    expect(files).toContain("index.esm.js");
  });
});
