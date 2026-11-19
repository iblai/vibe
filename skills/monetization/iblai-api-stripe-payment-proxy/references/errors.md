# Stripe payment proxy — error surface

Every status a caller can get under `providers/stripe/`, what produces it, and what to
do. Messages are paraphrased — wording is not a stable contract, so branch on the status
and the body shape, never on the text.

## Body shapes

| Shape | Produced by |
|---|---|
| `{"error": "<message>", "code": "<stripe code>"}` | A Stripe failure relayed or translated by the platform; `code` is Stripe's own (`resource_missing`, `card_declined`, `rate_limit_error`, …). |
| `{"error": "<message>"}` | A platform-side refusal: no Stripe source, a paywall rule, the `{org}` binding, nothing connected. |
| `{"error": "Permission denied"}` | A missing RBAC verb. |
| `{"<field>": ["<message>"]}` | Request or query validation by the platform — the key names the field. |
| `{"detail": "<message>"}` | Framework-level: no or invalid token, a non-member path user, a wrong method. |
| Stripe's object, verbatim | Every `200` on the proxy. |

## Statuses

| Status | Condition | What to do |
|---|---|---|
| 400 | The typed floor failed: `name` missing on a product, `currency` (or both `product` and `product_data`) missing on a price, empty `line_items`, `query` missing on search, `limit` outside 1–100, a body that is not an object. | Fix the field named in the body. |
| 400 | No Stripe source for the organization — no pasted `stripe` credential and no linked account. | An admin adds the credential (`/iblai-api-integration`) or links an account (`POST connect/`). Not fixable by retrying. |
| 400 | Stripe rejected the request; `code` is Stripe's (`parameter_unknown`, `resource_missing` on a referenced id, …). | Read `code` and `error`; Stripe's docs describe the parameter. |
| 400 | A paywall rule: the price is inactive or its product is not tagged `metadata.app` = `app`; another price than the recorded one; no recorded price for a caller buying on their own path; embedded checkout on a source without a publishable key; hosted checkout without `success_url`/`cancel_url`; a redirect host that is not localhost, a deployed app of the organization or one of its custom domains (the body names only the host). | Fix what the body names; record the price (see the paywall reference) or add the publishable key to the source. |
| 400 | Connect: `return_url` off the allowed hosts, the shared `main` organization, or Connect not configured on this instance. Also `DELETE connect/` when the instance can no longer talk to Stripe's OAuth. | Use an allowed URL; a pasted key is the alternative on an instance without Connect. |
| 401 | No token, or one the platform does not recognise. | Authenticate — this is about your ibl.ai token, never about Stripe. |
| 402 | Stripe's card error, relayed (`code` such as `card_declined`). | Surface it to the buyer. |
| 403 | The body names the organization: `{org}` is not the organization your token belongs to (an unknown key gets the same answer, on purpose). | Use your own organization key. |
| 403 | `Permission denied`: the verb is missing — a member on the admin surface, a member on another user's path, a `token_policies`-mode API token, a custom role without the verb. | Use an owner-mode token or an admin's; grant the verb. |
| 404 | `{username}` is not a member of `{org}`. | Fix the path user. |
| 404 | Stripe does not know the id (`code: resource_missing`) — including ids minted on a previously connected account. | Check the id; after a reconnect, re-create. |
| 404 | `DELETE connect/` with nothing linked. | Nothing to do. |
| 404 | The route does not exist on this (self-hosted) backend. | Upgrade the instance; `connect/` arrived after the proxy and the paywall. |
| 405 | Wrong method — updates are `POST`; there is no `DELETE` on proxy objects. | Fix the method. |
| 409 | `POST connect/` while an account is already linked; or a Stripe conflict, relayed. | `DELETE connect/` first; read `code`. |
| 429 | Stripe rate-limited the organization's account; `Retry-After` is set when Stripe sent one. | Back off for `Retry-After` seconds, then retry with the same `Idempotency-Key`. |
| 502 | Stripe rejected the **configured** credential — a wrong or revoked key, a connected account that revoked the platform. | The admin re-saves the key or reconnects. Not the caller's fault. |
| 502 | Stripe was unreachable, timed out, or answered 5xx (503 included). On a **write** the outcome is indeterminate. | Retry with the **same** `Idempotency-Key`; a read is simply retried. |
| 502 | `DELETE connect/` could not confirm the revocation at Stripe. **The link is kept.** | Retry. |
| 503 | `POST connect/` (or `DELETE`) when the instance has nowhere to keep the OAuth state; `GET connect/` says `available: false`. | An operator's fix. A pasted key, and an account already linked, keep working meanwhile. |

## Upstream translation

The platform does not pass Stripe's status through blindly:

| Stripe answered | Caller gets | Why |
|---|---|---|
| 401, 403 | **502** | A credential problem is the organization's configuration, never the request — you never see Stripe's auth failure as your own. |
| 400, 402, 404, 409 | same status | Relayed with Stripe's `code`. |
| 429 | 429 (+ `Retry-After`) | Relayed. |
| 5xx, timeout, connection failure | **502** | Transient — but on a write, possibly applied. |

## The indeterminate write

The platform sends every request once, with a short fixed timeout, and never retries on
its own. A `502` on a `POST` therefore means Stripe did not answer in time — which
includes "Stripe applied it and the answer was lost". Send an `Idempotency-Key` on every
create and update, keep it for the retry, and Stripe returns the original result instead
of a duplicate. A workable pattern is one prefix per run and one suffix per write
(`$RUN-product`, `$RUN-price`, `$RUN-link`).

## `reason` codes on the Connect return URL

After `POST connect/`, the admin's browser lands on
`return_url?stripe_connect=error&reason=<code>` when the link did not happen:

| `reason` | Meaning | What to do |
|---|---|---|
| `access_denied` | The admin cancelled on Stripe. | Nothing, or start again. |
| `invalid_grant` | Stripe refused the one-time code at the platform's exchange — spent twice, or the instance's Connect configuration mixes test and live. | Try once more; if it repeats, ibl.ai support fixes the instance. A pasted key works meanwhile. |
| `already_connected` | The organization already has a linked account. | `DELETE connect/` first. |
| `account_linked_elsewhere` | That Stripe account is linked to another organization. | Use another account, or unlink it there. |
| `not_configured` | The instance has no Connect configuration, or Stripe rejected it. | ibl.ai support. |
| `oauth_error` | Stripe came back without a code or an account id. | Retry. |
| `platform_missing` | The organization was deleted mid-flow. | — |
| `stripe_unreachable` | Stripe did not answer, or answered 429/5xx. | Retry. |

A tampered, expired or reused `state` gets `400` JSON at the callback itself — there is
no trusted URL to redirect to — and Stripe is never called again for it.
