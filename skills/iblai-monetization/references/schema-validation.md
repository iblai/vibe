# Schema validation — fetch the live OpenAPI schema before constructing URLs

## Why this matters

Every monetization workflow skill cites URL paths and payload shapes for
orientation. Those citations are correct at the moment the skill is written, but
the deployed contract drifts — endpoints get renamed, fields get added,
response codes change. The OpenAPI schema served from `api.iblai.app` is the
authoritative mirror of what is actually deployed *right now*. Treat it as the
source of truth; treat skill prose as the map.

Validate against the schema before:

- Hard-coding a URL path in fetch/RTK Query code.
- Constructing a request body or asserting on a response shape.
- Reading a 4xx error that doesn't match the documented response.
- Declaring monetization work done.

## Schema URLs

- **Raw schema:** `https://api.iblai.app/dm/api/docs/schema/` — OpenAPI 3.0.3 YAML,
  about 3.5 MB. Served without authentication (the schema itself is public; the
  endpoints it describes still require `Authorization: Token <token>` per
  Platform — see Authentication note below).
- The `info.version` field at the top of the schema exposes the deployed
  `ibl-data-manager` build. Use it to confirm you are reading the same build
  your app is talking to.

The schema is the only OpenAPI surface mounted at this host — there is no
Swagger UI or ReDoc UI deployed publicly. Work directly with the YAML.

## Fetch routine

Cache the schema once per session, then grep it locally — re-fetching 3.5 MB on
every lookup is wasteful.

```bash
# fetch + cache locally for the session
curl -sS -o /tmp/iblai_schema.yaml "https://api.iblai.app/dm/api/docs/schema/"

# confirm the build you cached
grep -E "^  title:|^  version:" /tmp/iblai_schema.yaml

# list every monetization-related path (billing + Stripe Connect)
grep -E "^(  )?/api/billing|^(  )?/api/service/platforms/\{platform_key\}/stripe/connect" /tmp/iblai_schema.yaml
```

Re-fetch when you suspect drift (your code 4xxes against a documented success
shape, or CI fails after the backend deploys).

## Pin a specific endpoint

Once a path looks relevant, extract its full operation definition — methods,
parameters, request body, response codes, response shapes. Three approaches,
pick whichever your install supports.

**Approach A — `yq` (cleanest when available).**

```bash
yq '.paths["/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/access-check/"]' \
  /tmp/iblai_schema.yaml
```

**Approach B — Python (works everywhere Python 3 + PyYAML are present).**

```bash
python3 -c "
import yaml
s = yaml.safe_load(open('/tmp/iblai_schema.yaml'))
print(s['paths']['/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/access-check/'])
"
```

**Approach C — grep with trailing context (no parser, no install).**

```bash
grep -A 30 "^  /api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/access-check/" \
  /tmp/iblai_schema.yaml
```

Approach C is the most portable — pair it with `-A N` where `N` is large enough
to capture the operation through its `responses:` block. Bump `N` if you see
the next path's heading before the responses.

## Component lookup ($ref resolution)

Operation responses commonly reference reusable schemas:

```yaml
responses:
  '200':
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/ItemAccessCheckResponse'
```

To inspect that referenced shape:

```bash
# yq
yq '.components.schemas.ItemAccessCheckResponse' /tmp/iblai_schema.yaml

# python
python3 -c "
import yaml
s = yaml.safe_load(open('/tmp/iblai_schema.yaml'))
print(s['components']['schemas']['ItemAccessCheckResponse'])
"

# grep
grep -A 40 "^    ItemAccessCheckResponse:" /tmp/iblai_schema.yaml
```

Component definitions are indented four spaces under `components.schemas`, so
the grep anchor is `"^    <SchemaName>:"`. Bump `-A N` if the schema nests
deeply or chains `allOf` refs to other components — follow each `$ref` the
same way.

## Drift detection — does every URL in code still exist?

Before merging a monetization PR, sweep the codebase for `/api/billing/...` and
`/api/service/...` paths and check each one against the cached schema:

```bash
grep -rEho '/api/(billing|service)[^"\s)\\]+' src/ \
  | sort -u \
  | while read url; do
      grep -q "$url" /tmp/iblai_schema.yaml || echo "DRIFT: $url"
    done
```

Any line printed `DRIFT: ...` is a URL your code calls that the deployed
backend no longer exposes. Re-fetch the schema first (in case the cache is
stale), then either correct the URL in your code or open a backend issue.

Adjust the path argument (`src/`) to wherever your fetch/RTK Query call sites
live. Add more roots by repeating: `grep -rEho '...' src/ packages/`.

## What to do on a 4xx that doesn't match the documented response

The deployed contract is the final word, but the source of truth lives in two
mirrors — the OpenAPI schema and the SDK's TypeScript types. When a response
shape surprises you, work through them in this order:

1. **Schema first.** Re-fetch `/tmp/iblai_schema.yaml`, re-run the pin command
   for the offending operation, and confirm the response code and `$ref` shape
   you actually expect. The schema is what the backend serializer emits.
2. **SDK types.** Cross-check the corresponding TypeScript types in
   `packages/data-layer/src/features/monetization/types.ts` (in
   `iblai/ibl-web-frontend`). If schema and types disagree, the SDK is stale.
3. **File an issue.** If the deployed behavior contradicts both schema and
   SDK, that's a backend bug — open it at
   `https://github.com/iblai/ibl-web-frontend` (or the relevant repo) with the
   path, method, expected schema ref, and actual response body.

## Authentication note

The schema endpoint itself is unauthenticated — `curl` without headers returns
200. Consuming the endpoints the schema describes still requires
`Authorization: Token <token>` (and is scoped by the Platform that issued the
token). A few endpoints are intentionally public (`AllowAny`) for guest
checkout and public pricing — see [/iblai-monetization-checkout] for the list.
Fetching the schema unauthenticated has no bearing on whether the endpoints
inside it are protected.

## The monetization flows in schema terms

All monetization paths land under exactly two tags in the deployed schema —
`billing` for the paywall/credits/checkout/subscription/analytics surface, and
`commerce` for Stripe Connect onboarding. The granular per-flow tags you might
expect (`stripe-connect`, `paywall-config`, `prices`, etc.) do not exist as
schema tags on these operations.

| Flow (skill family member) | Schema tag | Path prefix |
|---|---|---|
| Stripe Connect onboard (`/iblai-monetization-onboard`) | `commerce` | `/api/service/platforms/{platform_key}/stripe/connect/...` |
| Paywall + price configuration (`/iblai-monetization-configure`) | `billing` | `/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/paywall[...]` |
| Access check + checkout (`/iblai-monetization-checkout`) | `billing` | `/api/billing/...access-check/`, `.../checkout/`, `.../checkout-guest/`, `.../checkout-callback/`, `/api/billing/prices/{price_unique_id}/checkout-guest/`, `/api/billing/items/{config_unique_id}/public-pricing/` |
| Subscriptions (`/iblai-monetization-subscriptions`) | `billing` | `/api/billing/platforms/{platform_key}/items/{item_type}/{item_id}/subscription[...]`, `/api/billing/platforms/{platform_key}/my-subscriptions/` |
| Analytics + admin (`/iblai-monetization-analytics`) | `billing` | `/api/billing/platforms/{platform_key}/{revenue,paywalls,subscribers}/`, `.../items/{item_type}/{item_id}/subscribers/` |

To list every tag the schema uses (across the whole API, not just monetization)
and confirm tag values yourself:

```bash
grep -E "^      tags:" -A 1 /tmp/iblai_schema.yaml \
  | grep -E "^      - " \
  | sort -u
```

To pull just the monetization paths grouped by tag:

```bash
python3 -c "
import yaml
s = yaml.safe_load(open('/tmp/iblai_schema.yaml'))
for path, ops in s['paths'].items():
    if not ('/api/billing' in path or '/api/service/platforms/{platform_key}/stripe/connect' in path):
        continue
    for method, op in ops.items():
        if isinstance(op, dict) and 'tags' in op:
            print(f'{method.upper():6s} {path} -> {op[\"tags\"]}')
            break
"
```

The latter is the same command used to populate the table above — re-run it
whenever you need to confirm the tag assignment after a backend release.

## Related skills

- [/iblai-monetization] — overview and index for the family
- [/iblai-monetization-onboard] — Stripe Connect onboarding (`commerce` tag)
- [/iblai-monetization-configure] — paywall + price CRUD (`billing` tag)
- [/iblai-monetization-checkout] — access check + checkout (`billing` tag)
- [/iblai-monetization-subscriptions] — user subscriptions (`billing` tag)
- [/iblai-monetization-analytics] — revenue + subscribers (`billing` tag)
