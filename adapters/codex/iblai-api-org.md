# iblai-api-org

> Read and write an ibl.ai organization's org-wide settings via the platform API — the org metadata object holding Default Agent, Help Center URL, Chat Area Width, and feature toggles (Help/Accessibility menus, Community Agents, Report Inappropriate Content). Use when configuring org-wide behavior.

# iblai-api-org

Read and write an organization's org-wide settings from the API: settings that
all live inside one org **metadata** object — Default Agent, Help Center URL,
Chat Area Width, and the feature toggles. Use when configuring org-wide behavior.

## Auth & conventions

- **Base URL:** `https://api.iblai.app`
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG`, `{username}` = `$IBLAI_USERNAME`.
- **Every setting is a key inside ONE org-metadata object.** To change a
  setting you **GET** the whole object, **merge** your changed key into it, and
  **PUT** the whole object back. Never drop existing keys — anything you omit is
  lost.
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Reads

- **GET** `https://api.iblai.app/dm/api/core/orgs/{org}/metadata/` — read all org settings.
- **GET** `https://api.iblai.app/dm/api/search/orgs/{org}/users/{username}/mentors/` — source of valid Default Agent values.

## Writes

- **PUT** `https://api.iblai.app/dm/api/core/orgs/{org}/metadata/` — save settings (send the whole object back with your key merged in):
  ```json
  {
    "metadata": {
      "…existing…": "preserved",
      "<settingKey>": "boolean|string"
    }
  }
  ```
  - **Default Agent** → `overall_default_mentor` (agent `unique_id` or `"none"`)
  - **Help Center URL** → `help_center_url` (string)
  - **Chat Area Width** → `chat_area_size` (string)
  - **Help Menu** / **Accessibility Menu** / **Persistent Chat Input Label** /
    **Community Agents** / **Report Inappropriate Content** → boolean, keyed by
    the metadata-catalog slug assigned at runtime.

## Example

Set the Help Center URL while preserving every other key — read first, merge,
then write the whole object back:

```bash
# 1. read the current metadata object
curl -s "https://api.iblai.app/dm/api/core/orgs/$IBLAI_ORG/metadata/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" > metadata.json

# 2. merge the changed key into the object, then PUT it all back
curl -X PUT \
  "https://api.iblai.app/dm/api/core/orgs/$IBLAI_ORG/metadata/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"metadata": {"…existing keys preserved…": "...", "help_center_url": "https://help.example.com"}}'
```

## Notes

- The PUT replaces the metadata object — always GET first, merge your one key,
  and resend the full object so existing settings survive.
- `overall_default_mentor` takes a agent `unique_id` from the mentor-source
  endpoint, or the literal string `"none"` to clear it.
- The toggle keys (Help Menu, Accessibility Menu, Persistent Chat Input Label,
  Community Agents, Report Inappropriate Content) are slugs assigned by the
  metadata catalog at runtime — read them off the GET response rather than
  hardcoding.