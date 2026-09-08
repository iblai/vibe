# edX LMS SSO setup (Google, Microsoft, Apple, OIDC)

How to add Single Sign-On identity providers (IdPs) to the Open edX LMS
(`iblai-edx-pro`) so learners log in with an external provider instead of a local
edX password. Covers four backend families:

| Provider | edX backend slug | Backend class |
| --- | --- | --- |
| Google | `google-oauth2` | `social_core.backends.google.GoogleOAuth2` |
| Microsoft (Azure AD / Entra ID) | `azuread-oauth2` | `social_core.backends.azuread.AzureADOAuth2` |
| Apple | `apple-id` | `social_core.backends.apple.AppleIdAuth` |
| OpenID Connect (generic) | `ibl-oauth2` (configurable) | `ibl_base_oauth_sso_backend.auth.IBLBaseOAuthSSOBackend` |

Google, Microsoft, and Apple use the stock `social-core` backends that ship with edX.
OpenID Connect uses the in-house `ibl-edx-base-oauth-sso-backend-app` plugin, which
wraps `social_core.backends.open_id_connect.OpenIdConnectAuth` and talks to any
standards-compliant OIDC provider (Okta, Ping, ForgeRock/AM, Auth0, Keycloak, a
corporate IdP, etc.).

Examples below use org key `iblai` and LMS domain `learn.iblai.com` — substitute your
own.

## Two config layers

Every provider has two independent layers:

1. **Deployment config** (`ibl config save …`) — enables third-party auth, registers
   the backend classes, and (for OIDC) sets endpoint/claim settings baked into LMS
   Django settings by a Tutor plugin. Requires a config re-apply + LMS restart.
2. **Runtime config** (LMS Django admin at
   `/admin/third_party_auth/oauth2providerconfig/`) — one row per provider carrying the
   client ID, client secret, and per-provider options. Changes take effect immediately,
   no redeploy.

**How the login flows:**

```
Learner → LMS login → /auth/login/<slug>/ → IdP consent
        → IdP redirects to /auth/complete/<slug>/ → edX third_party_auth
        → social-core backend validates token/claims
        → edX finds-or-creates the user, links UserSocialAuth
        → (OIDC only) user is linked to the platform_key org
```

- `ENABLE_THIRD_PARTY_AUTH` turns the edX third-party-auth subsystem on.
- `THIRD_PARTY_AUTH_BACKENDS` is the allowlist of backend classes edX may load.
- Each enabled provider needs a matching `OAuth2ProviderConfig` row whose **Backend
  name** equals the backend slug.

The deployment config lives in
`iblai-cli-ops/ibl/templates/config/defaults.yml` under
`IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND`, rendered into LMS settings by the Tutor
plugin `iblai-cli-ops/ibl/templates/tutor-plugins/ibl-edx-base-oauth-sso-backend.py`.

### The plugin gate — enable it even for stock backends

The **entire** plugin (including the `ENABLE_THIRD_PARTY_AUTH` and
`THIRD_PARTY_AUTH_BACKENDS` patches) is wrapped in:

```jinja
{% if IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.ENABLE_EDX_BASE_OAUTH_SSO_BACKEND %} … {% endif %}
```

`ENABLE_EDX_BASE_OAUTH_SSO_BACKEND` defaults to `false`, so the settings this plugin
manages apply **only when the plugin is enabled**. You must enable it **even if you
only use the stock Google/Microsoft/Apple backends**, because that flag also gates the
`ENABLE_THIRD_PARTY_AUTH: true` and `THIRD_PARTY_AUTH_BACKENDS` patches.

## Step 0 — Prerequisites (per provider)

Register an OAuth2/OIDC client with the IdP and collect:

- **Client ID** and **Client Secret**.
- The exact **redirect URI** (callback / reply URL):
  `https://learn.iblai.com/auth/complete/<slug>/`. For example:
  - Google: `.../auth/complete/google-oauth2/`
  - Microsoft: `.../auth/complete/azuread-oauth2/`
  - Apple: `.../auth/complete/apple-id/`
  - OIDC: `.../auth/complete/iblai-oauth2/` (your chosen slug)
- **Scopes:** request at least `openid profile email` so edX can build a username,
  email, and full name.
- **OIDC only:** the provider's **discovery URL**
  (`…/.well-known/openid-configuration`). Everything before that suffix is your
  `OIDC_ENDPOINT`. E.g. discovery
  `https://id.iblai.com/oauth2/realms/alpha/.well-known/openid-configuration` →
  `OIDC_ENDPOINT = https://id.iblai.com/oauth2/realms/alpha`.

## Step 1 — Enable third-party auth (deployment config)

Run once per environment. Each `ibl config save --set` writes one `KEY=VALUE` override
onto the user config layered over `defaults.yml`.

```bash
# Required: activates the plugin block (and therefore the two patches below)
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.ENABLE_EDX_BASE_OAUTH_SSO_BACKEND=true

# Turn the edX third-party-auth subsystem on
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.ENABLE_THIRD_PARTY_AUTH=true
```

`THIRD_PARTY_AUTH_BACKENDS` already includes Google, Microsoft (AzureAD), Apple, and
the IBL OIDC backends in `defaults.yml`:

```yaml
THIRD_PARTY_AUTH_BACKENDS:
  - social_core.backends.google.GoogleOAuth2
  - social_core.backends.azuread.AzureADOAuth2
  - social_core.backends.apple.AppleIdAuth
  - ibl_base_oauth_sso_backend.auth.IBLBaseOAuthSSOBackend
  - ibl_base_oauth_sso_backend.auth_openid.IBLOpenIDOAuthSSOBackend
  # ... other backends
```

Only override it to trim the list to the exact set you use. Pass it as a JSON array string:

```bash
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.THIRD_PARTY_AUTH_BACKENDS='["social_core.backends.google.GoogleOAuth2", "social_core.backends.azuread.AzureADOAuth2", "social_core.backends.apple.AppleIdAuth", "ibl_base_oauth_sso_backend.auth.IBLBaseOAuthSSOBackend"]'
```

Apply the config (Step 4) after this.

## Step 2 — Provider-specific deployment config

### Google

No plugin settings required. Stock backend; client ID/secret go in the Django admin
(Step 3). Ensure `social_core.backends.google.GoogleOAuth2` is in
`THIRD_PARTY_AUTH_BACKENDS` (it is by default).

### Microsoft (Azure AD / Entra ID)

No plugin settings required for a single- or multi-tenant Azure AD app; client
ID/secret go in the Django admin. Ensure `social_core.backends.azuread.AzureADOAuth2`
is in `THIRD_PARTY_AUTH_BACKENDS` (it is by default).

- The Azure AD **"Application (client) ID"** is the Client ID; a client secret
  **value** (not the secret ID) is the Client Secret.
- `azuread-oauth2` is in `TRACKED_PROVIDERS` by default, so an Azure AD user is linked
  to the org named in the provider's `other_settings.platform_key` (see
  [Linking users to an org](#linking-users-to-an-org-tracked_providers)).

### Apple

No plugin settings required, but the credentials are shaped differently:

- **Client ID** is the Apple **Services ID** (e.g. `com.iblai.learn.signin`).
- **Client Secret** is a **signed JWT** you generate from your `.p8` private key, Team
  ID, and Key ID. It **expires (max 6 months)**, so regenerate it periodically or
  generate it dynamically.
- Ensure `social_core.backends.apple.AppleIdAuth` is in `THIRD_PARTY_AUTH_BACKENDS`
  (it is by default).
- Apple returns the user's name **only on the first authorization** — treat the email
  claim as the durable identifier.

### OpenID Connect (generic, via the IBL backend)

`IBLBaseOAuthSSOBackend` (in `ibl_base_oauth_sso_backend/auth.py`) reads the
`IBL_OAUTH_SSO_*` namespace. Set endpoint, slug, and claim mappings via `ibl config save`.

Minimum (provider exposes a discovery document):

```bash
# Backend slug / provider name — becomes the login+callback slug
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.IBL_OAUTH_SSO_NAME='iblai-oauth2'
# OIDC issuer base (everything before /.well-known/openid-configuration)
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.IBL_OAUTH_SSO_OIDC_ENDPOINT='https://id.iblai.com/oauth2/realms/alpha'
```

Claim → edX field mappings (defaults shown; override only if your IdP uses different
claim names):

```bash
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.IBL_OAUTH_SSO_USERNAME_KEY='preferred_username'
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.IBL_OAUTH_SSO_EMAIL_KEY='email'
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.IBL_OAUTH_SSO_FIRST_NAME_KEY='given_name'
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.IBL_OAUTH_SSO_LAST_NAME_KEY='family_name'
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.IBL_OAUTH_SSO_FULLNAME_KEY='name'
```

Optional endpoints — set only if the provider has **no** discovery document, or to pin
them. When `IBL_OAUTH_SSO_OIDC_ENDPOINT` is set, these are fetched from
`/.well-known/openid-configuration` automatically:

```bash
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.IBL_OAUTH_SSO_AUTHORIZATION_URL='https://id.iblai.com/oauth2/authorize'
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.IBL_OAUTH_SSO_ACCESS_TOKEN_URL='https://id.iblai.com/oauth2/token'
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.IBL_OAUTH_SSO_USERINFO_URL='https://id.iblai.com/oauth2/userinfo'
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.IBL_OAUTH_SSO_JWKS_URI='https://id.iblai.com/oauth2/connect/jwk_uri'
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.IBL_OAUTH_SSO_ID_TOKEN_ISSUER='https://id.iblai.com/oauth2'
```

Common OIDC options:

```bash
# Some IdPs (e.g. ForgeRock/AM) send an nbf claim the default validator rejects
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.IBL_OAUTH_SSO_JWT_DECODE_OPTIONS='{ "verify_nbf": False }'

# Require HTTPS on the callback (recommended in production)
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.SOCIAL_AUTH_REDIRECT_IS_HTTPS=true
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.SSL_PROTOCOL=true

# Only allow existing users to log in (block auto-provisioning of new accounts)
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.IBL_OAUTH_SSO_DISABLE_USER_CREATION=true

# Read user fields from the id_token instead of the userinfo response
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.IBL_OAUTH_SSO_USE_IDTOKEN_FIELDS=true
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.IBL_OAUTH_SSO_IDTOKEN_FIELD_MAPPINGS='{ "username": "preferred_username", "email": "email", "first_name": "given_name", "last_name": "family_name", "fullname": "name" }'
```

**Running more than one OIDC provider.** edX keys each `OAuth2ProviderConfig` by
`(site_id, backend_name)` — a second row for the same backend name **supersedes** the
first, it doesn't run both. To run two OIDC providers side by side, use the second
backend class, which reads a parallel `IBL_OPENID_SSO_*` namespace and defaults to the
`openid-oauth2` slug:

```bash
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.IBL_OPENID_SSO_NAME='partner-oauth2'
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.IBL_OPENID_SSO_OIDC_ENDPOINT='https://idp.partner.com/oauth2'
```

`IBLOpenIDOAuthSSOBackend` (`openid-oauth2`) and `IBLOpenIDTwoBackend`
(`openidtwo-oauth2`) are already in the default `THIRD_PARTY_AUTH_BACKENDS`; each gets
its own admin config row.

## Step 3 — Add the provider in the LMS Django admin

After the config is applied and the LMS restarts, add one provider config at
`https://learn.iblai.com/admin/third_party_auth/oauth2providerconfig/` →
**Add OAuth2 Provider Config**. Each save creates a new versioned row; the newest
enabled row for a backend name wins.

**Common fields (all four providers):**

| Field | Value | Notes |
| --- | --- | --- |
| Enabled | checked | Activates the provider. |
| Name | e.g. `Google`, `Microsoft`, `Apple`, `IBL AI SSO` | Display name on the login page. |
| Slug | the backend slug | `google-oauth2`, `azuread-oauth2`, `apple-id`, or your OIDC slug. |
| Site | the LMS site (e.g. `learn.iblai.com`) | Must match the site users log in on. |
| Backend name | same slug as above | Must equal the backend's `name`. |
| Client ID | from the IdP | See per-provider notes. |
| Client Secret | from the IdP | See per-provider notes. |
| Visible | checked | Show the button on login/register. |
| Skip hinted login dialog | checked | Smoother SSO-first experience. |
| Skip registration form | checked | Auto-provision from claims. |
| Skip email verification | checked | Trust the IdP-verified email. |
| Sync learner profile data | checked | Keep name/email in sync each login. |

**Per-provider Client ID/Secret:**

- **Google** — Backend name `google-oauth2`; ID/secret from the Google Cloud OAuth client.
- **Microsoft** — Backend name `azuread-oauth2`; ID = Azure "Application (client) ID";
  Secret = the secret **value**.
- **Apple** — Backend name `apple-id`; ID = Apple Services ID; Secret = the signed JWT.
- **OpenID Connect** — Backend name = your `IBL_OAUTH_SSO_NAME` slug (e.g.
  `iblai-oauth2`); ID/secret from the OIDC client.

**Other settings (JSON).** The **Other settings** field takes a JSON object;
social-core overlays it on the namespace defaults, so you can pin per-provider
endpoints here without a redeploy. For the IBL OIDC backend:

```json
{
  "platform_key": "iblai",
  "OIDC_ENDPOINT": "https://id.iblai.com/oauth2/realms/alpha",
  "logout_url": "https://id.iblai.com/oauth2/logout"
}
```

- `platform_key` — the org these users are linked to (see below).
- `OIDC_ENDPOINT` — optional override of the discovery base for this row.
- `logout_url` — optional; used by the backend's single-logout flow. If omitted, the
  backend uses the provider's `end_session_endpoint` from discovery.

### Linking users to an org (TRACKED_PROVIDERS)

When a provider's slug is in `TRACKED_PROVIDERS`, users who log in through it are
automatically linked to the org named in that provider's `other_settings.platform_key`.
Default tracked list:

```
azuread-oauth2, cloud-ibl-sso, atom-ibl-sso, atom-sp-ibl-sso,
vhl-oauth2, openid-oauth2, openidtwo-oauth2
```

To auto-link Google/Apple or a custom OIDC slug to an org, add its slug to
`TRACKED_PROVIDERS` **and** set `platform_key` in its `other_settings`:

```bash
ibl config save --set IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND.TRACKED_PROVIDERS='["azuread-oauth2", "google-oauth2", "iblai-oauth2"]'
```

A tracked provider with **no** `platform_key` in `other_settings` is skipped (the user
is authenticated but not linked to any org).

## Step 4 — Apply and restart

Deployment-config changes (Steps 1–2) only take effect after regenerating config and
restarting the LMS:

```bash
ibl config save            # regenerate compose/settings from the user config
ibl tutor config save      # render the Tutor plugin into LMS settings
ibl edx stop
ibl edx start -d
```

Django-admin changes (Step 3) take effect immediately — no restart.

## Verify

1. Open `https://learn.iblai.com/login` — the enabled provider buttons should appear.
2. Click a provider, complete the IdP login, confirm you land back on the LMS
   authenticated.
3. In the admin, check `/admin/social_django/usersocialauth/` for a new row with the
   expected `provider` (slug) and `uid`.
4. For OIDC org linking, confirm the user appears under the expected `platform_key` org.

## Troubleshooting

- **Provider button not shown** — the plugin gate
  (`ENABLE_EDX_BASE_OAUTH_SSO_BACKEND=true`) or `ENABLE_THIRD_PARTY_AUTH` is off, the
  config wasn't re-applied/restarted, or the admin row isn't `Enabled`/`Visible`.
- **Backend not found / not loaded** — the backend class is missing from
  `THIRD_PARTY_AUTH_BACKENDS`, or the admin **Backend name** doesn't exactly match the
  backend slug.
- **redirect_uri_mismatch** — the IdP's registered redirect URI doesn't exactly match
  `https://learn.iblai.com/auth/complete/<slug>/` (check trailing slash and http vs https).
- **State validation failures (intermittent)** — the IBL OIDC backend stores OAuth
  state in Redis with a session fallback to survive concurrent logout and load-balancer
  session loss; if errors persist, confirm Redis is reachable from the LMS.
- **Email is required but not provided** — the IdP returned no email claim. Ensure the
  `email` scope is granted and `IBL_OAUTH_SSO_EMAIL_KEY` matches the claim name.
- **New users blocked** — `IBL_OAUTH_SSO_DISABLE_USER_CREATION=true` only allows
  pre-existing users to log in.
- **OIDC token rejected on nbf** — set
  `IBL_OAUTH_SSO_JWT_DECODE_OPTIONS='{ "verify_nbf": False }'`.

## Source references

- Plugin template: `iblai-cli-ops/ibl/templates/tutor-plugins/ibl-edx-base-oauth-sso-backend.py`
- Defaults: `iblai-cli-ops/ibl/templates/config/defaults.yml` (`IBL_EDX.IBL_EDX_BASE_OAUTH_SSO_BACKEND`)
- OIDC backend: `iblai-edx-pro/apps/ibl-edx-base-oauth-sso-backend-app/src/ibl_base_oauth_sso_backend/auth.py`
- Setting definitions/defaults: `.../ibl_base_oauth_sso_backend/config.py`
- Org-linking signal: `.../ibl_base_oauth_sso_backend/signals.py`
