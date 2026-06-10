# `iblai update-gallery` — regenerate the Component Gallery

Rewrites the **Component Gallery** section of a skill's `SKILL.md` from the
live `@iblai/web-containers` package, so the documented component list never
drifts from what the SDK actually exports.

```bash
iblai update-gallery skills/
iblai update-gallery skills/iblai-components/SKILL.md
iblai update-gallery skills/ --screenshots --platform acme \
  --username admin@acme.com --password s3cret
```

## Argument

- `PATH` (required, must exist) — either a **skills directory** (the command
  resolves `iblai-components/SKILL.md` inside it) or a **direct path** to the
  `SKILL.md` to update.

## What it does (default)

1. Fetches the latest `@iblai/web-containers` from the npm registry.
2. Extracts the `.d.ts` type declarations and discovers every exported React
   component.
3. Rewrites the Component Gallery section in place and writes the file back,
   reporting the export count and the resolved `@iblai/web-containers@<version>`.

## `--screenshots` (optional)

Also captures a PNG per component category and saves them next to the
`SKILL.md`. It scaffolds a temporary Next.js app, renders each category, and
drives it with Playwright. This path **requires** three values (flag or env):

| Flag | Env var | Purpose |
|---|---|---|
| `--platform` | `IBLAI_PLATFORM_KEY` | Platform key to render against |
| `--username` | `PLAYWRIGHT_USERNAME` | Login email for auth |
| `--password` | `PLAYWRIGHT_PASSWORD` | Login password for auth |

If any are missing, the command errors before doing work. If screenshot
capture fails, it logs a warning and continues with a text-only gallery
update (non-fatal).

## When to run it

After the SDK is upgraded, or when the gallery looks stale — it's the
maintenance step that keeps `iblai-component`'s catalog in sync with the
installed `@iblai/web-containers`.

## Related

- Owning skill: [`../SKILL.md`](../SKILL.md) (iblai-component).
