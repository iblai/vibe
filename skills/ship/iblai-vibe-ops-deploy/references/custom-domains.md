# Custom domains for a hosted app

Every hosted project has an address the moment the deploy is accepted — either a
subdomain the platform assigns it automatically, or a custom domain your
organization configured. This reference covers configuring that domain,
re-verifying it, reclaiming it and detaching it.

`site_url` on the deploy response is always the address to show the user. The
routes below only change *which* address that is.

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

All of this is **admin-only**, authorised by the organization's API key. A
personal sign-in token gets a 403.

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

It is also how a **lost** domain comes back. If the domain was taken over by
another organization while this one was not serving it (see below), a successful
verification here reclaims it — the other organization is detached and the
domain is re-attached to this project.

| Status | Meaning | Fix |
|---|---|---|
| 200 | Checked. Read `verified` and `misconfigured` | If `verified` is false, the records are not visible yet — wait and repeat |
| 400 | Not a hosted domain — this row belongs to one of the ibl.ai sign-in/app domains, not a deployed site | Manage those through the custom-domains routes below |
| 403 | Not the organization's API key, or hosting is admin-only for this caller | Use the admin key your operator issued |
| 404 | No such domain for this organization | Check the `id` against the listing |
| 503 | This instance does not offer domain re-verification yet | Ask your ibl.ai operator to update it |

## Detach a domain from the organization

> Confirm with the user first — this removes the domain everywhere, not just
> from one project.

```bash
curl -s -X DELETE "$ORG_BASE/providers/vercel/hosting/domains/$DOMAIN_ID/" -H "$AUTH"
```

`204` on success. It detaches the domain from its project before dropping it, so
nothing is left serving a site the organization no longer tracks.

## List the organization's domains

```bash
curl -s "$DOMAINS/?platform_key=$PLATFORM" -H "$AUTH" | jq
```

Optional query parameters: `domain=<name>` to look one up, `include_deleted=true`
to include soft-deleted rows.

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

## How a domain moves between organizations

A domain is held by one organization at a time. If a second one tries to deploy
to a domain the first still serves, that is a `400` and nothing is created.

If the first organization's site **no longer serves** the domain, the second one
takes it over: the first is detached and its record is kept and marked with
`lost_at`, so an admin can see what happened. The check runs before anything is
created, so a refused domain leaves nothing behind — and a domain that was lost
comes back the moment it verifies again.

Domains that can never be claimed: the automatically assigned subdomain
namespace (its own apex, and names like `www` under it), and provider-owned
hosts such as `*.vercel.app`.
