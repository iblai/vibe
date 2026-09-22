# Auth — customizing the sign-in page (Step 2 in full)

Moved out of `SKILL.md` to keep the skill scannable; this is the full text.

### Fetch platform name

First, read `PLATFORM` and `TOKEN` from `iblai.env`, then fetch the
platform metadata to get the platform name:

```bash
curl -s "https://api.{domain}/dm/api/core/orgs/{platform}/metadata/" \
  -H "Authorization: Api-Token {token}"
```

Use the `platform_name` field from the response as the auth **title**.

### Ask the user

Ask these two questions together:

1. **"Briefly describe what your app does"**
2. **"Do you want a navbar with logo, page links, notification bell, and profile dropdown?"**

If the user says yes to the navbar, run `/iblai-vibe-navbar` after Step 8
(Replace Default Home Page).

If the user skips or doesn't want to answer, use the platform name as
`AUTH_DISPLAY_TITLE` and leave `AUTH_DISPLAY_DESCRIPTION` empty. If the
user provides a description, generate a headline and tagline from it.

Use `https://ibl.ai/images/iblai-logo.png` as the default logo (favicon,
display logo, and side panel logo).

Remaining fields use fixed defaults:

- **Footer credit** — Always `"Powered by {{logo}}"` (the `{{logo}}` placeholder renders the ibl.ai logo)
- **Privacy policy URL** — Always `"https://ibl.ai/privacy-policy"`
- **Terms of use URL** — Always `"https://ibl.ai/terms-of-use"`
- **Display images** — Leave empty (`[]`)
- **Password-only login** — Default `false`

### Save to `iblai.env`

After generating the fields, append them to `iblai.env` so the user can
review and edit before the API call:

```bash
# Auth interface (edit before proceeding)
AUTH_TITLE=<platform_name from API>
AUTH_LOGO=https://ibl.ai/images/iblai-logo.png
AUTH_DISPLAY_TITLE=<platform_name from API>
AUTH_DISPLAY_DESCRIPTION=
AUTH_FOOTER_CREDIT=Powered by {{logo}}
AUTH_PRIVACY_POLICY_URL=https://ibl.ai/privacy-policy
AUTH_TERMS_OF_USE_URL=https://ibl.ai/terms-of-use
AUTH_PASSWORD_ONLY=false
```

Tell the user: "I've saved the generated auth settings to `iblai.env`.
Review them and edit if needed, then let me know to continue."

STOP and wait for the user to confirm before proceeding with the API calls.
Re-read `iblai.env` to pick up any edits the user made.

After confirmation, use `PLATFORM` and `TOKEN` from `iblai.env` for all
API calls. All API requests use this header:
```
Authorization: Api-Token <token>
```

### Upload images first

If `AUTH_LOGO` is a **local file path**, upload it via:

```bash
curl -X POST "https://api.{domain}/dm/api/core/platforms/{platform}/public-image-assets/" \
  -H "Authorization: Api-Token {token}" \
  -F "image=@{file_path}" \
  -F "category={category}"
```

Upload the logo three times with different categories. If `AUTH_LOGO` is
already a URL (like the default), use it directly in the metadata payload
without uploading.
| Image | Category |
|-------|----------|
| Favicon | `auth_spa_favicon` |
| Display logo | `auth_spa_logo` |
| Side panel logo | `auth_spa_slide_panel_logo` |
| Display images (each) | `auth_spa_display_image` |

The POST response returns a JSON object. Extract the `file` field — that is
the URL to use in the metadata payload.

If the user provided a **URL** (not a local file), use it directly in the
metadata payload without uploading.

### PUT the metadata

After all images are uploaded, assemble the payload and PUT to:

```
PUT https://api.{domain}/dm/api/core/orgs/{platform}/metadata/
Authorization: Api-Token {token}
Content-Type: application/json
```

The payload has two identical keys — `auth_web_skillsai` and
`auth_web_mentorai` — both containing the same configuration:

```json
{
  "auth_web_skillsai": {
    "title": "User's Title",
    "favicon": "https://...uploaded-logo-url...",
    "display_logo": "https://...uploaded-logo-url...",
    "footer_credit": "Powered by {{logo}}",
    "display_images": [],
    "terms_of_use_url": "https://ibl.ai/terms-of-use",
    "display_title_info": "Generated headline",
    "privacy_policy_url": "https://ibl.ai/privacy-policy",
    "display_description_info": "Generated description",
    "display_slide_panel_logo": "https://...uploaded-logo-url...",
    "authorize_only_password_login": false
  },
  "auth_web_mentorai": {
    "title": "User's Title",
    "favicon": "https://...uploaded-logo-url...",
    "display_logo": "https://...uploaded-logo-url...",
    "footer_credit": "Powered by {{logo}}",
    "display_images": [],
    "terms_of_use_url": "https://ibl.ai/terms-of-use",
    "display_title_info": "Generated headline",
    "privacy_policy_url": "https://ibl.ai/privacy-policy",
    "display_description_info": "Generated description",
    "display_slide_panel_logo": "https://...uploaded-logo-url...",
    "authorize_only_password_login": false
  }
}
```

Always use ibl.ai's privacy policy and terms of use URLs. Generate the
headline and description from the user's app description. Set
`authorize_only_password_login` to `false`.

After a successful PUT (200), tell the user: "Your login page has been
customized! Changes will appear on your next login at https://login.{domain}".
