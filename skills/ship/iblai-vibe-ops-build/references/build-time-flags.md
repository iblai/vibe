# Native builds — organization lock and in-app-purchase build-time flags

Moved out of `SKILL.md` to keep the skill scannable; this is the full text.

## Build-Time Flags (Organization Lock & In-App Purchase)

The Tauri shell exposes two build-time flags so a **single codebase can
produce differently-configured builds** — e.g. one desktop/mobile build
locked to organization A and another locked to organization B, both served from the same
app URL. The values are baked in at `cargo build` time via Rust's
`option_env!`, so they are set as **environment variables in the build shell**
(not `iblai.env`, which holds the platform shorthand) before running the build:

| Env var | Command exposed to JS | Default | Effect |
|---|---|---|---|
| `IBL_TENANT` | `get_locked_tenant` → `string` | `""` (unlocked) | Locks the build to one organization: the frontend forces login to it and hides organization switching. |
| `IBL_ALLOW_IN_APP_PURCHASE` | `allow_in_app_purchase` → `bool` | `false` | Enables in-app purchase UI. Truthy values: `1`/`true`/`yes`/`on` (case-insensitive). |

Set them before the build (they are read at compile time, so they must be in
the environment when cargo compiles `src-tauri`):

```bash
# tenant-locked build with in-app purchase enabled
IBL_TENANT=acme IBL_ALLOW_IN_APP_PURCHASE=true pnpm exec tauri build
```

In CI, set them as env on the build step:

```yaml
- name: Build
  env:
    IBL_TENANT: acme
    IBL_ALLOW_IN_APP_PURCHASE: "true"
  run: pnpm exec tauri build
```

`src-tauri/build.rs` declares `cargo:rerun-if-env-changed` for both, so cargo
recompiles when a value changes between builds. Unset → the "off" default, so
a normal build is unaffected.

**Frontend consumption** (app code, outside this template) invokes the
commands and reacts to them:

```ts
import { invoke } from '@tauri-apps/api/core';

const lockedTenant = await invoke<string>('get_locked_tenant'); // '' = unlocked
const iap = await invoke<boolean>('allow_in_app_purchase');
```

When `get_locked_tenant` returns a non-empty key, force the user onto that
organization (logging out of any other) and hide the organization switcher. The commands
are registered in `src-tauri/src/lib.rs` (`generate_handler!`); no extra ACL
entry is needed since they are application commands.
