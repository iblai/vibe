# Deploy to a server — container recipe

For when the app has to run somewhere the team controls: a district VM, on-prem
hardware, Cloud Run, ECS, a Kubernetes cluster, a customer's own tenant.

Prerequisite: [`runtime-config.md`](runtime-config.md). A container that bakes
its backend in is a container that can only ever be one environment — do that
part first.

## Two shapes

**Next.js app (skillsai, mentorai, vibe-starter).** Multi-stage: build with
pnpm, run with `next start`. An `entrypoint.sh` writes `public/env.js` from the
environment, then execs the server. Both shipping apps already have this —
copy theirs rather than inventing one:

```dockerfile
FROM node:20 AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY . .
RUN pnpm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next .next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json /app/next.config.mjs /app/entrypoint.sh ./
RUN chmod +x entrypoint.sh
EXPOSE 5000
ENTRYPOINT ["./entrypoint.sh"]
CMD ["pnpm", "exec", "next", "start", "-p", "5000"]
```

**Static app (no build step).** nginx serving a directory, plus a tiny runtime
to render the config. Install `nodejs` in the runtime image so the config
generator has one implementation shared with local dev and CI — a shell
reimplementation is a second source of truth and will drift:

```dockerfile
FROM nginx:1.27-alpine
RUN apk add --no-cache nodejs
COPY public/ /srv/www/
COPY tools/gen-config.mjs /srv/tools/gen-config.mjs
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/entrypoint.sh /srv/entrypoint.sh
RUN chmod +x /srv/entrypoint.sh \
    && touch /var/run/nginx.pid \
    && chown -R nginx:nginx /srv/www /var/cache/nginx /var/run/nginx.pid
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
ENTRYPOINT ["/srv/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
```

Port **8080**, user **nginx** — an unprivileged container needs no
`NET_BIND_SERVICE` and drops straight into a hardened runtime.

## nginx: the routes that are not optional

```nginx
server {
    listen 8080;
    root /srv/www;
    index index.html;

    location = /healthz { access_log off; return 200 'ok'; }

    # Rewritten on every container start — never cache it.
    location = /iblai-config.js { add_header Cache-Control 'no-store' always; }

    # THE ONE THAT BREAKS DEPLOYS. The ibl.ai Auth SPA returns to
    # <origin>/sso-login-complete with no .html extension.
    location = /sso-login-complete { try_files /sso-login-complete.html =404; }

    # Client-routed sub-apps.
    location /app/ { try_files $uri $uri/ /app/index.html; }

    location ~* /assets/.+\.(js|css|woff2?|png|jpg|svg)$ {
        expires 1y;
        add_header Cache-Control 'public, immutable';
    }
    location ~* \.html$ { add_header Cache-Control 'no-cache' always; }

    location / { try_files $uri $uri/ =404; }

    location ~ /(\.|iblai\.env) { deny all; }
}
```

If the app is also deployed to Firebase or S3, keep the two configs in sync and
say so in a comment in both. They are the same routing table written twice, and
they drift silently.

## Entrypoint

```sh
#!/bin/sh
set -e
# --env /dev/null: in a container the environment is the only source. Falling
# back to a committed config file would silently serve whichever tenant was
# checked in — exactly what this indirection exists to prevent.
node /srv/tools/gen-config.mjs --env /dev/null --out /srv/www/iblai-config.js
[ -z "$IBLAI_PLATFORM" ] && echo "WARNING: IBLAI_PLATFORM unset" >&2
exec "$@"
```

## Compose

```yaml
services:
  web:
    build: { context: . }
    restart: unless-stopped
    ports: ["${PORT:-8080}:8080"]
    environment:
      IBLAI_DOMAIN: "${IBLAI_DOMAIN:-iblai.app}"
      IBLAI_PLATFORM: "${IBLAI_PLATFORM:?set the tenant key}"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:8080/healthz"]
      interval: 30s
```

Compose reads `.env` automatically, so a second environment is a second `.env`
— no rebuild.

## TLS

Nothing in the container terminates TLS. Put it behind what the team already
runs:

```
app.district.edu {
    reverse_proxy localhost:8080
}
```

(Caddy, which also handles certificates.) Behind nginx, forward `Host` and
`X-Forwarded-Proto`.

## CI

Build on every PR to prove the Dockerfile still works; publish on merge. Then
**smoke-test the image you just built** — a container that starts is not a
container that serves:

```yaml
- run: |
    docker run -d --name smoke -p 8080:8080 \
      -e IBLAI_DOMAIN=example.test -e IBLAI_PLATFORM=ci-tenant smoke:local
    for i in $(seq 1 20); do curl -fsS http://127.0.0.1:8080/healthz && break || sleep 1; done
    curl -fsS -o /dev/null http://127.0.0.1:8080/
    curl -fsS -o /dev/null http://127.0.0.1:8080/sso-login-complete   # the rewrite
    curl -fsS http://127.0.0.1:8080/iblai-config.js | grep -q ci-tenant  # env reached the config
```

Those three assertions catch the three things that actually break: the app, the
SSO callback, and configuration that never made it out of the environment.

Tag with the commit sha, not `latest` — promoting an environment should mean
running a known digest with different variables.

## Before it works

Add the deployment origin to the tenant's **allowed redirect origins**. Sign-in
leaves for the login SPA and returns to `<origin>/sso-login-complete`; an
origin the tenant does not know is a login that never comes back.

## Related

- Runtime config: [`runtime-config.md`](runtime-config.md)
- Platform hosting path (the default): [`../SKILL.md`](../SKILL.md) Steps 1–5
- Owning skill: [`../SKILL.md`](../SKILL.md)
