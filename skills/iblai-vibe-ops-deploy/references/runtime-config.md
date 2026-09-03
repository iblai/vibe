# Runtime configuration — one artifact, every environment

An ibl.ai frontend is mostly defined by *which backend it talks to*: the tenant
key, `api.*`, `login.*`, `mentorai.*`, the ASGI socket. Where those values live
decides whether the app can be deployed twice.

**Build-time is the wrong place.** `NEXT_PUBLIC_*` are inlined into the client
bundle by the compiler; a config file edited by hand and committed is inlined
into the repo. Either way the artifact *is* an environment:

- staging and production are different builds of the same commit
- repointing a customer means a rebuild, not a restart
- promoting "the build that passed QA" promotes something that was never
  actually tested against production
- a self-hosting customer has to build from source to change a hostname

**Runtime is the right place.** Render the config when the process starts, from
the environment it started in. Same image, different variables, different
deployment.

## The pattern

Both shipping ibl.ai apps already do this. `skillsai/entrypoint.sh` and
`mentorai/entrypoint.sh` write a `window.__ENV__` object into a file the app
loads before its bundle, then exec the server:

```sh
#!/bin/sh
set -e

cat <<EOF > /app/public/env.js
window.__ENV__ = {
  NEXT_PUBLIC_API_BASE_URL: "${NEXT_PUBLIC_API_BASE_URL}",
  NEXT_PUBLIC_AUTH_URL: "${NEXT_PUBLIC_AUTH_URL}",
  NEXT_PUBLIC_MENTOR_URL: "${NEXT_PUBLIC_MENTOR_URL}",
  NEXT_PUBLIC_PLATFORM_BASE_DOMAIN: "${NEXT_PUBLIC_PLATFORM_BASE_DOMAIN}",
};
EOF

exec "$@"
```

Read it with a helper that falls back to the compiled-in value, so local `pnpm
dev` keeps working:

```ts
export const env = (key: string, fallback = '') =>
  (typeof window !== 'undefined' && window.__ENV__?.[key]) ||
  process.env[key] ||
  fallback
```

For an app with no build step, generate the whole config file instead — same
idea, one implementation shared by local dev, static deploys and containers.
The WRSD platform's `tools/gen-config.mjs` renders `public/iblai-config.js`
from `iblai.env` **or** `IBLAI_*` environment variables, and its container
entrypoint calls it with `--env /dev/null` so only the environment can win.

## Derive, don't enumerate

ibl.ai hostnames follow `<service>.<domain>`. Take **one** value and derive:

```js
const domain  = raw.domain || 'iblai.app'
const api     = raw.apiBaseUrl || `https://api.${domain}`
const auth    = raw.authUrl    || `https://login.${domain}`
const mentor  = raw.mentorUrl  || `https://mentorai.${domain}`
const ws      = raw.wsBaseUrl  || `wss://asgi.data.${domain}`
```

Moving to a self-hosted `iblai/os` then costs one variable instead of five kept
consistent by hand. Keep the per-endpoint overrides for installs that do not
follow the convention, but let blank mean *derive* — never ship them filled in
with the defaults they would have derived anyway, or `domain` becomes a knob
that silently does nothing.

## Rules

1. **Never emit the platform `TOKEN`.** It is server-side only. Browser config
   is served to every visitor. Generators should not have a code path that can
   include it.
2. **Serve the config `no-store`.** Cached, a repointed deployment keeps
   sending returning users to the old backend — and it looks like the repoint
   silently failed.
3. **Generated files are generated.** Put a DO-NOT-EDIT header on them, and
   give CI a `--check` mode that regenerates and diffs. Hand-editing a
   generated config is how half a deployment ends up on one backend.
4. **Prefix environment variables.** `IBLAI_DOMAIN`, not `DOMAIN`. Unprefixed
   generic names collide with whatever else is in the container's environment.
5. **Warn when the tenant is unset** at startup, in the entrypoint. A blank
   platform key produces a confusing empty app, not an error.

## What cannot move

Be explicit, in the deploy docs, about anything that does *not* follow the
config — a legacy backend, an SSO client id tied to one domain, an analytics
project. A repoint that silently leaves one surface pointing at the old
environment is worse than one that refuses to.

## Related

- Container recipe: [`docker-deploy.md`](docker-deploy.md)
- Owning skill: [`../SKILL.md`](../SKILL.md)
- Auth/env plumbing: `iblai-vibe-auth`
