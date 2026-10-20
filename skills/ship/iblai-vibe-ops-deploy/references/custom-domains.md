# Custom domains for a hosted app

A hosted project has an address the moment the deploy is accepted — the
subdomain chosen for it under the platform's shared domain (like a username;
the deploy runbook's Step 3.6), or a custom domain your organization
configured. This reference covers configuring that domain,
re-verifying it, reclaiming it and detaching it.

`site_url` on the deploy response is the address to show the user, and the
routes below change *which* address that is.

**`site_url` can be `null` on an accepted (202) deploy.** Three cases, none of
them an error, and each answering with an empty `site_domain_error` as well — so
there is no message explaining it, because nothing was attempted:

- your organization uses **its own** hosting credential rather than the
  instance-wide one, so there is no shared domain to choose a subdomain under;
- the instance offers **no shared domain** at all;
- the backend is older than chosen subdomains.

Then the deployment's own `url` is the address once the build is READY — or
choose a subdomain, below. Do not treat a `null` `site_url` as a failed deploy:
the app is live either way.

## Variables

The deploy runbook's `$BASE` includes `users/$IBLAI_USERNAME`. Two of the routes
here do **not** sit under a user, so they need their own bases — using `$BASE`
for them produces a 404.

```bash
BASE="https://api.$DOMAIN/dm/api/ai-mentor/orgs/$PLATFORM/users/$IBLAI_USERNAME"
ORG_BASE="https://api.$DOMAIN/dm/api/ai-mentor/orgs/$PLATFORM"   # no users/ segment
DOMAINS="https://api.$DOMAIN/dm/api/custom-domains"
AUTH="Authorization: Api-Token $IBLAI_API_KEY"
```

The hosting routes — everything under `$BASE` and `$ORG_BASE` — are
**admin-only**, authorised by the organization's API key; a personal sign-in
token gets a 403. The `$DOMAINS` listing is the exception: it answers without
authentication. Treat a domain name as public information.

## Attach a domain to a project

```bash
curl -s -X POST "$BASE/providers/vercel/hosting/dns/" -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d "{\"project\": $ID, \"domain\": \"app.example.com\"}" | jq '.required_records'
```

Hand the returned `required_records` to the user — they add them at their
registrar. Each record is `{type, name, value, reason}`; `reason` says why it is
needed, so it can be shown as-is.

`verified: false` in the response is **normal and not an error** for a domain
the organization owns: it means the records are not visible in DNS yet. Tell the
user to add them and re-check later, do not treat it as a failure.

## Choose a subdomain

Send `subdomain` instead of `domain` — one label, lowercase letters, digits and
hyphens, like a username — and the project is served at
`<subdomain>.<the platform's shared domain>`. Nothing for the user to buy,
configure or verify — the address works immediately. A body with neither
`domain` nor `subdomain` is a `400`: the platform never invents an address.

```bash
curl -s -X POST "$BASE/providers/vercel/hosting/dns/" -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d "{\"project\": $ID, \"subdomain\": \"smallsite\"}" | jq
```

`201` with the same shape as an attach, and `site_url` moves to the new host.
This is the fix when a deploy came back with `site_url: null` — including a
project deployed before the instance offered a shared domain at all — and the
route for renaming: a different subdomain moves `site_url` and leaves the
previous host attached until it is detached (below).

Asking twice is safe: a project that already has that exact host gets it handed
back with `200` rather than a second one. A project already served at a custom
domain gets the subdomain **alongside** it — the response carries the new host,
but `site_url` keeps the custom domain. Detach the custom domain and ask again
to make the subdomain the address.

| Status | Meaning | Fix |
|---|---|---|
| 201 | Chosen. The response carries the new name | Show it to the user; it serves as soon as the build is READY |
| 200 | The project already has this subdomain; the response carries it | Nothing to do — same as 201 |
| 400 | No hosting credential is configured for the organization | Configure one, or ask your ibl.ai operator |
| 400 with a `subdomain` key | Neither `domain` nor `subdomain` was sent, both were, or the label is malformed | Send exactly one; a label is lowercase letters, digits and hyphens, no leading or trailing hyphen |
| 409 | That name is taken — by another organization, another of your projects, or it is a reserved label such as `www` | Ask the user for a different subdomain |
| 4xx naming a host | The subdomain recorded for the project no longer exists at the provider (removed in its dashboard, or detached under another project) | Detach that host through the routes below, then ask again |
| 4xx with `code` | The provider refused the attach itself | Read `error`; a `409` here means the name is taken on the provider's side — ask the user for a different subdomain |
| 429 | The provider rate-limited the request | Back off and retry; honour `Retry-After` when it is present |
| 502 | The provider is unreachable, or it rejected the instance's hosting credential | Retry later; if it persists, ask your ibl.ai operator |
| 503 | No subdomain can be chosen: no shared domain is on offer (the instance configures none, or your organization is on its own hosting credential), the shared domain is offered but currently unreachable, or this instance cannot yet record a subdomain for this project | The error body says which. Attach a domain you own instead (above), or ask your ibl.ai operator to update the instance |

## Inspect what a project has

```bash
# every domain on the project
curl -s "$BASE/providers/vercel/hosting/dns/?project=$ID" -H "$AUTH" | jq

# one domain, with its verification state and records
curl -s "$BASE/providers/vercel/hosting/dns/?project=$ID&domain=app.example.com" \
  -H "$AUTH" | jq
```

Without `domain` you get the list; with it you get the full record:
`{name, apex_name, verified, verification, misconfigured, configured_by,
required_records}`.

`verified` and `misconfigured` answer different questions. `verified` is "has
the organization proved it owns this name"; `misconfigured` is "is DNS currently
pointing here". A domain can be verified and still misconfigured.

## Detach a domain from a project

> Confirm with the user first — the site stops answering on that domain.

```bash
curl -s -X DELETE \
  "$BASE/providers/vercel/hosting/dns/?project=$ID&domain=app.example.com" \
  -H "$AUTH"
```

## Re-verify or reclaim a domain

```bash
curl -s -X POST "$ORG_BASE/providers/vercel/hosting/domains/$DOMAIN_ID/" -H "$AUTH" | jq
```

`$DOMAIN_ID` is the `id` from the `/custom-domains/` listing below — **not** a
project id. This route is scoped to the organization, not to a user or a
project, because the screen that lists an organization's domains has neither.

Use it when the user says they have added the DNS records: it re-asks, stores
the result, and returns the same `{name, apex_name, verified, verification,
misconfigured, configured_by, required_records}` shape plus `records`.

A `200` with `verified: false`, an empty `records` and a `detail` means the
domain is configured but no app has been deployed to it yet — deploy a project
with it (the deploy runbook's `domain` field) to get its records.

A domain attached before this route existed carries no record of which app
serves it. A re-verify then asks the provider about the organization's deployed
apps in turn until one has the domain, records that app, and verifies as usual —
so the question is asked once for a domain some app serves. A domain no app
serves is asked about again on every re-verify, one call per app.

It is also how a **lost** domain comes back. If the domain was taken over by
another organization while this one was not serving it (see below), a successful
verification here reclaims it — the other organization is detached and the
domain is re-attached to this project.

| Status | Meaning | Fix |
|---|---|---|
| 200 | Checked. Read `verified` and `misconfigured` | If `verified` is false, the records are not visible yet — wait and repeat |
| 400 | Not a hosted domain — this row belongs to one of the ibl.ai sign-in/app domains, not a deployed site | Manage those through the custom-domains routes below |
| 400, 404, 409 with `code` | The provider refused the check; `error` carries its reason | A 404 means the app no longer has the domain — detach it (below) and attach it again |
| 403 | Not the organization's API key, or hosting is admin-only for this caller | Use the admin key your operator issued |
| 404 | No such domain for this organization | Check the `id` against the listing |
| 429 | The provider rate-limited the check | Back off and retry; honour `Retry-After` when it is present |
| 502 | The provider is unreachable, or it rejected the instance's hosting credential | Retry later; if it persists, ask your ibl.ai operator |
| 503 | This instance does not offer domain re-verification yet | Ask your ibl.ai operator to update it |

## Detach a domain from the organization

> Confirm with the user first — this removes the domain everywhere, not just
> from one project.

```bash
curl -s -X DELETE "$ORG_BASE/providers/vercel/hosting/domains/$DOMAIN_ID/" -H "$AUTH"
```

`204` on success. It detaches the domain from its project before dropping it, so
nothing is left serving a site the organization no longer tracks.

For a domain attached before this route existed, the detach first asks the
provider which of the organization's deployed apps serves it and detaches it
there. That needs the organization's hosting credential whenever the
organization has deployed apps: without one the detach answers `400` rather
than dropping a domain the provider would keep serving. A domain no app serves
is dropped once every app has answered that it does not have it; only an
organization with no deployed apps drops it without a provider call.

| Status | Meaning | Fix |
|---|---|---|
| 204 | Detached at the provider and dropped | Nothing further |
| 400 | No hosting credential is configured while the organization has deployed apps (the body says so), or the row is one of the ibl.ai sign-in/app domains | Configure the credential, or manage that row through the custom-domains routes below |
| 400, 409 with `code` | The provider refused the detach; `error` carries its reason. A domain the provider no longer knows about is not an error here — it is simply dropped | Read `error`, resolve it at the provider, retry |
| 403, 404, 503 | As for re-verify above | As above |
| 429, 502 | The provider rate-limited the request, or is unreachable | Back off and retry; honour `Retry-After` when it is present |

## List the organization's domains

```bash
curl -s "$DOMAINS/?platform_key=$PLATFORM" -H "$AUTH" | jq
```

Optional query parameters: `domain=<name>` to look one up, `status=<value>` to
filter by DNS registration state, and `include_deleted=true` to include
soft-deleted rows.

The response is an envelope, not a bare array — and a query that matches nothing
answers `{}`, with no `custom_domains` key at all, so read it defensively:

```bash
curl -s "$DOMAINS/?platform_key=$PLATFORM" -H "$AUTH" \
  | jq '.custom_domains // [] | length'
```

```json
{ "custom_domains": [ … ], "count": 2 }
```

Each row carries:

| Field | Meaning |
|---|---|
| `id` | Use this as `$DOMAIN_ID` above |
| `custom_domain` | The domain name |
| `spa` | `vercel` for a deployed site; other values are ibl.ai's own sign-in/app domains |
| `verified_at` | When the organization last proved it controls the domain; `null` if never |
| `lost_at` | When another organization claimed it; `null` while the organization still holds it |
| `records` | The DNS records to set, structured: `[{type, name, value, reason}]` |
| `instructions` | The same records as free text — **prefer `records`**, do not parse this |
| `is_deleted` | Soft-delete flag |

`verified_at: null` with a non-empty `records` is the ordinary "we are waiting
for DNS" state. A non-null `lost_at` means the domain now belongs to someone
else; re-verify it (above) to take it back.

## Deleting through the custom-domains route

```bash
curl -s -X DELETE "$DOMAINS/$DOMAIN_ID/delete/" -H "$AUTH"
```

This works for ibl.ai's own sign-in/app domains. For a **deployed site's**
domain (`spa: "vercel"`) it answers `400` and points at the hosting domains
route instead — deleting here would drop the record while the domain carried on
serving, with nothing left tracking it. Use the detach route above.

Hiding the row is refused for the same reason:

```bash
curl -s -X POST "$DOMAINS/$DOMAIN_ID/deleted-status/" -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"is_deleted": true}'
```

`400` for a `spa: "vercel"` row. Restoring one — `{"is_deleted": false}` — stays
allowed, and is the way back for a row that was hidden before the refusal
existed.

## How a domain moves between organizations

A domain is held by one organization at a time. If a second one tries to deploy
to a domain the first still serves, that is a `400` and nothing is created.

If the first organization's site **no longer serves** the domain, the second one
takes it over: the first is detached and its record is kept and marked with
`lost_at`, so an admin can see what happened. The check runs before anything is
created, so a **refused** domain leaves nothing behind — and a domain that was
lost comes back the moment it verifies again.

A takeover that *succeeds* is committed before the deploy runs, and is **not**
undone if that deploy then fails (a 409 for a push already in flight, say). The
previous holder is left detached for a deployment that never happened; the
domain is free, and either organization can re-verify to take it.

Domains that can never be claimed as a custom domain: the shared subdomain
namespace (chosen with `subdomain` instead — its apex, and names like `www`
under it, are reserved for everyone), and provider-owned hosts such as
`*.vercel.app`.
