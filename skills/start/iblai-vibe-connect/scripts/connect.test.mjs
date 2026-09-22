// Tests for connect.mjs — the pure parts run without a browser or the network.
// Run: node --test skills/start/iblai-vibe-connect/scripts/

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  applyPlan,
  buildConnectUrl,
  buildPlan,
  defaultOriginFor,
  defaultTokenName,
  envUpdatesFor,
  HostedPageUnavailable,
  maskToken,
  mergeEnvContent,
  NetworkError,
  nextEnvContent,
  nextGitignoreContent,
  parseArgs,
  parsePasteBlock,
  probeHostedPage,
  randomState,
  redact,
  resolveCallback,
  StateMismatch,
  stateMatches,
  successLine,
  verifyToken,
} from "./connect.mjs";

const TOKEN = "sk-not-a-real-token-9f2c";
const VALUES = {
  domain: "iblai.app",
  org: "acme",
  org_name: "Acme Inc",
  username: "mika",
  token: TOKEN,
};

function sandbox() {
  return mkdtempSync(join(tmpdir(), "ibl-connect-"));
}

// --------------------------------------------------------------------------
// Token masking
// --------------------------------------------------------------------------

test("maskToken shows only the last four characters", () => {
  assert.equal(maskToken(TOKEN), "****9f2c");
  assert.equal(maskToken("ab"), "****ab");
  assert.equal(maskToken(""), "****");
});

test("redact replaces a leaked secret anywhere in a string", () => {
  const leaky = `wrote TOKEN=${TOKEN} to iblai.env (${TOKEN})`;
  const safe = redact(leaky, TOKEN);
  assert.ok(!safe.includes(TOKEN));
  assert.equal(safe, "wrote TOKEN=****9f2c to iblai.env (****9f2c)");
});

test("successLine names the organization and never the whole token", () => {
  assert.equal(successLine(VALUES), "connected: Acme Inc (acme) as mika · token ****9f2c");
  assert.equal(
    successLine({ ...VALUES, org_name: undefined }),
    "connected: acme (acme) as mika · token ****9f2c",
  );
  assert.ok(!successLine(VALUES).includes(TOKEN));
});

// --------------------------------------------------------------------------
// Arguments and URL
// --------------------------------------------------------------------------

test("parseArgs reads both --flag value and --flag=value", () => {
  assert.deepEqual(parseArgs(["--domain", "example.test", "--org=acme", "--dry-run"]), {
    help: false, paste: false, dryRun: true, domain: "example.test", name: null, origin: null, org: "acme",
  });
  assert.equal(parseArgs(["--paste"]).paste, true);
  assert.equal(parseArgs(["--help"]).help, true);
  assert.throws(() => parseArgs(["--nope"]), /unknown option/);
  assert.throws(() => parseArgs(["--domain"]), /needs a value/);
});

test("defaultTokenName labels the token with project and machine", () => {
  assert.equal(defaultTokenName({ packageName: "my-app", machine: "laptop" }), "my-app on laptop");
  assert.equal(defaultTokenName({ dirName: "folder", machine: "laptop" }), "folder on laptop");
});

test("defaultOriginFor only offers an origin for a Next.js app", () => {
  assert.equal(defaultOriginFor({ dependencies: { next: "16" } }), "http://localhost:3000");
  assert.equal(defaultOriginFor({ devDependencies: { next: "16" } }), "http://localhost:3000");
  assert.equal(defaultOriginFor({ dependencies: { vite: "5" } }), null);
  assert.equal(defaultOriginFor(null), null);
});

test("buildConnectUrl carries callback, state, name and the optional extras", () => {
  const url = new URL(buildConnectUrl({
    domain: "iblai.app", port: 54321, state: "abc", name: "my-app on laptop",
    origin: "http://localhost:3000", org: "acme",
  }));
  assert.equal(url.origin + url.pathname, "https://login.iblai.app/connect");
  assert.equal(url.searchParams.get("callback"), "http://127.0.0.1:54321/callback");
  assert.equal(url.searchParams.get("state"), "abc");
  assert.equal(url.searchParams.get("name"), "my-app on laptop");
  assert.equal(url.searchParams.get("origin"), "http://localhost:3000");
  assert.equal(url.searchParams.get("org"), "acme");

  const bare = new URL(buildConnectUrl({ domain: "iblai.app", port: 1, state: "s", name: "n" }));
  assert.equal(bare.searchParams.has("origin"), false);
  assert.equal(bare.searchParams.has("org"), false);
});

// --------------------------------------------------------------------------
// The state check
// --------------------------------------------------------------------------

test("randomState is long and unpredictable", () => {
  const a = randomState();
  const b = randomState();
  assert.ok(a.length >= 32, `state too short: ${a.length}`);
  assert.notEqual(a, b);
});

test("stateMatches rejects everything but an exact echo", () => {
  assert.equal(stateMatches("abc", "abc"), true);
  assert.equal(stateMatches("abc", "abd"), false);
  assert.equal(stateMatches("abc", ""), false);
  assert.equal(stateMatches("abc", undefined), false);
});

test("resolveCallback refuses a mismatched state before doing anything", async () => {
  const fetchImpl = () => { throw new Error("must not be called"); };
  await assert.rejects(
    resolveCallback({ query: { state: "wrong", code: "c" }, state: "right", domain: "iblai.app", fetchImpl }),
    StateMismatch,
  );
});

test("resolveCallback exchanges a code for the values", async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, body: JSON.parse(init.body) });
    return {
      ok: true, status: 200,
      json: async () => ({
        domain: "iblai.app", org: "acme", org_name: "Acme Inc", username: "mika", token: TOKEN,
      }),
    };
  };
  const values = await resolveCallback({
    query: { state: "s1", code: "one-time" }, state: "s1", domain: "iblai.app", fetchImpl,
  });
  assert.equal(seen[0].url, "https://login.iblai.app/connect/exchange");
  assert.deepEqual(seen[0].body, { code: "one-time", state: "s1" });
  assert.deepEqual(values, {
    domain: "iblai.app", org: "acme", org_name: "Acme Inc", username: "mika", token: TOKEN,
  });
});

test("resolveCallback accepts the first-version fallback fields", async () => {
  const values = await resolveCallback({
    query: { state: "s1", org: "acme", username: "mika", token: TOKEN, domain: "iblai.app" },
    state: "s1", domain: "iblai.app",
    fetchImpl: () => { throw new Error("must not be called"); },
  });
  assert.equal(values.org, "acme");
  assert.equal(values.token, TOKEN);
});

// --------------------------------------------------------------------------
// Network steps (mocked fetch)
// --------------------------------------------------------------------------

test("probeHostedPage maps 404/405 to HostedPageUnavailable and errors to NetworkError", async () => {
  await assert.rejects(
    probeHostedPage({ domain: "iblai.app", fetchImpl: async () => ({ status: 404 }) }),
    HostedPageUnavailable,
  );
  await assert.rejects(
    probeHostedPage({ domain: "iblai.app", fetchImpl: async () => ({ status: 405 }) }),
    HostedPageUnavailable,
  );
  await assert.rejects(
    probeHostedPage({ domain: "iblai.app", fetchImpl: async () => { throw new Error("ENOTFOUND"); } }),
    NetworkError,
  );
  assert.equal(await probeHostedPage({ domain: "iblai.app", fetchImpl: async () => ({ status: 200 }) }), true);
});

test("verifyToken requires a 200 and reads the username back", async () => {
  let sentHeader;
  const ok = await verifyToken({
    domain: "iblai.app", token: TOKEN,
    fetchImpl: async (url, init) => {
      sentHeader = init.headers.Authorization;
      assert.equal(url, "https://api.iblai.app/dm/api/core/token/verify/");
      return { status: 200, json: async () => ({ username: "mika" }) };
    },
  });
  assert.equal(sentHeader, `Api-Token ${TOKEN}`);
  assert.deepEqual(ok, { username: "mika" });

  await assert.rejects(
    verifyToken({ domain: "iblai.app", token: TOKEN, fetchImpl: async () => ({ status: 401 }) }),
    /token refused/,
  );
});

// --------------------------------------------------------------------------
// --paste parsing
// --------------------------------------------------------------------------

test("parsePasteBlock reads the manual-mode block", () => {
  assert.deepEqual(parsePasteBlock(`
DOMAIN=iblai.app
PLATFORM=acme
TOKEN=${TOKEN}
IBLAI_USERNAME=mika
`), { domain: "iblai.app", org: "acme", token: TOKEN, username: "mika" });
});

test("parsePasteBlock accepts the .env spellings, quotes, export, and comments", () => {
  assert.deepEqual(parsePasteBlock(`
# pasted from login.iblai.app/connect
export IBLAI_ORG="acme"
IBLAI_API_KEY='${TOKEN}'
IBLAI_USERNAME = mika
NOT_A_KEY=ignored
no equals sign here
`), { org: "acme", token: TOKEN, username: "mika" });
});

test("parsePasteBlock ignores empty values and returns nothing for junk", () => {
  assert.deepEqual(parsePasteBlock("PLATFORM=\nTOKEN="), {});
  assert.deepEqual(parsePasteBlock(""), {});
});

// --------------------------------------------------------------------------
// Env-file merge logic
// --------------------------------------------------------------------------

test("mergeEnvContent updates matching lines in place and appends the rest", () => {
  const before = "# header\nDOMAIN=old.test\nUNRELATED=keep me\nPLATFORM=old-org\n";
  const after = mergeEnvContent(before, { DOMAIN: "iblai.app", PLATFORM: "acme", TOKEN: TOKEN });
  assert.equal(after, `# header\nDOMAIN=iblai.app\nUNRELATED=keep me\nPLATFORM=acme\nTOKEN=${TOKEN}\n`);
});

test("mergeEnvContent preserves comments, blank lines and key order", () => {
  const before = "A=1\n\n# a note\nB=2\n";
  assert.equal(mergeEnvContent(before, { B: "two" }), "A=1\n\n# a note\nB=two\n");
});

test("mergeEnvContent rewrites an exported key without the export prefix", () => {
  assert.equal(mergeEnvContent("export TOKEN=old\n", { TOKEN: "new" }), "TOKEN=new\n");
});

test("mergeEnvContent handles empty and newline-less input", () => {
  assert.equal(mergeEnvContent("", { A: "1" }), "A=1\n");
  assert.equal(mergeEnvContent("A=1", { B: "2" }), "A=1\nB=2\n");
});

test("nextEnvContent seeds a missing file from its .example", () => {
  const fromExample = nextEnvContent({
    existing: null,
    example: "# template\nDOMAIN=iblai.app\nPLATFORM=your-platform\nTOKEN=your-api-token\n",
    updates: { PLATFORM: "acme", TOKEN: TOKEN },
  });
  assert.equal(fromExample, `# template\nDOMAIN=iblai.app\nPLATFORM=acme\nTOKEN=${TOKEN}\n`);
});

test("nextEnvContent creates from nothing when there is no example", () => {
  assert.equal(nextEnvContent({ existing: null, example: null, updates: { A: "1" } }), "A=1\n");
});

test("envUpdatesFor maps one set of values onto the three files", () => {
  const u = envUpdatesFor(VALUES);
  assert.deepEqual(u["iblai.env"], {
    DOMAIN: "iblai.app", PLATFORM: "acme", TOKEN, IBLAI_USERNAME: "mika",
  });
  assert.deepEqual(u[".env"], { IBLAI_ORG: "acme", IBLAI_USERNAME: "mika", IBLAI_API_KEY: TOKEN });
  assert.deepEqual(u[".env.local"], { NEXT_PUBLIC_MAIN_TENANT_KEY: "acme", IBLAI_API_KEY: TOKEN });
});

// --------------------------------------------------------------------------
// .gitignore
// --------------------------------------------------------------------------

test("nextGitignoreContent creates a .gitignore when there is none", () => {
  const out = nextGitignoreContent(null);
  for (const entry of ["iblai.env", ".env", ".env.local"]) assert.match(out, new RegExp(`^${entry.replace(".", "\\.")}$`, "m"));
});

test("nextGitignoreContent appends only what is missing and keeps the rest", () => {
  const out = nextGitignoreContent("node_modules\n.env\n");
  assert.match(out, /^node_modules$/m);
  assert.equal(out.match(/^\.env$/gm).length, 1);
  assert.match(out, /^iblai\.env$/m);
  assert.match(out, /^\.env\.local$/m);
});

test("nextGitignoreContent is a no-op when everything is already ignored", () => {
  const already = "iblai.env\n.env\n.env.local\n";
  assert.equal(nextGitignoreContent(already), already);
  assert.equal(nextGitignoreContent("/iblai.env\n/.env\n/.env.local\n"), "/iblai.env\n/.env\n/.env.local\n");
});

// --------------------------------------------------------------------------
// buildPlan / applyPlan against a real temporary directory
// --------------------------------------------------------------------------

test("buildPlan skips .env.local when there is no package.json", () => {
  const dir = sandbox();
  const paths = buildPlan(dir, VALUES).map((e) => e.path);
  assert.ok(paths.includes(join(dir, "iblai.env")));
  assert.ok(paths.includes(join(dir, ".env")));
  assert.ok(!paths.includes(join(dir, ".env.local")));
});

test("buildPlan writes .env.local when a package.json is present", () => {
  const dir = sandbox();
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "my-app" }));
  const paths = buildPlan(dir, VALUES).map((e) => e.path);
  assert.ok(paths.includes(join(dir, ".env.local")));
});

test("applyPlan creates from example, updates in place, and appends", () => {
  const dir = sandbox();
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "my-app" }));
  // iblai.env is absent but has an example → created from it.
  writeFileSync(join(dir, "iblai.env.example"), "DOMAIN=iblai.app\nPLATFORM=your-platform\nTOKEN=your-api-token\n");
  // .env exists with one stale key and one unrelated key → updated in place.
  writeFileSync(join(dir, ".env"), "IBLAI_ORG=old-org\nKEEP=me\n");
  writeFileSync(join(dir, ".gitignore"), "node_modules\n");

  const plan = buildPlan(dir, VALUES);
  assert.equal(plan.find((e) => e.path.endsWith("iblai.env")).action, "create from example");
  assert.equal(plan.find((e) => e.path.endsWith("/.env")).action, "update");
  applyPlan(plan);

  const iblaiEnv = readFileSync(join(dir, "iblai.env"), "utf8");
  assert.match(iblaiEnv, /^PLATFORM=acme$/m);
  assert.match(iblaiEnv, /^IBLAI_USERNAME=mika$/m);
  assert.ok(!iblaiEnv.includes("your-api-token"));

  const dotEnv = readFileSync(join(dir, ".env"), "utf8");
  assert.match(dotEnv, /^IBLAI_ORG=acme$/m);
  assert.match(dotEnv, /^KEEP=me$/m);
  assert.match(dotEnv, /^IBLAI_API_KEY=/m);
  assert.ok(!dotEnv.includes("old-org"));

  assert.match(readFileSync(join(dir, ".env.local"), "utf8"), /^NEXT_PUBLIC_MAIN_TENANT_KEY=acme$/m);

  const gitignore = readFileSync(join(dir, ".gitignore"), "utf8");
  assert.match(gitignore, /^node_modules$/m);
  assert.match(gitignore, /^iblai\.env$/m);
});

test("buildPlan is idempotent — a second run has nothing to write", () => {
  const dir = sandbox();
  mkdirSync(join(dir, "sub"), { recursive: true });
  applyPlan(buildPlan(dir, VALUES));
  assert.deepEqual(buildPlan(dir, VALUES), []);
  assert.ok(existsSync(join(dir, ".gitignore")));
});
