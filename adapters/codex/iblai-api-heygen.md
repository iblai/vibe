# iblai-api-heygen

> Drive HeyGen through ibl.ai's dedicated video API — list and clone voices, synthesize speech, create photo and digital-twin avatars, generate avatar videos and poll them, upload media assets, and run interactive streaming avatar sessions end to end. Covers the credit rules, the ownership gate, and the LiveKit handoff. Use when building avatar video generation, voice cloning, or a talking-avatar experience; see /iblai-api-external-service-proxy for the generic multi-provider proxy door.

# iblai-api-heygen

> **Two doors to HeyGen.** This skill documents the **dedicated** surface under
> `providers/heygen/video/` — member-reachable, credit-metered, with an ownership
> gate and first-class streaming support. `/iblai-api-external-service-proxy`
> documents the **generic** door (`/api/ai-proxy/orgs/{org}/services/heygen/{action}/`),
> which is organization-admin-only and reaches a wider action catalog. Pick the
> dedicated surface for anything a signed-in user does for themselves; pick the proxy
> for admin automation over actions this surface does not expose.

Generate and manage HeyGen media through ibl.ai. The Data Manager forwards to HeyGen
and returns **HeyGen's own response body**, so HeyGen's API docs describe the payload
shapes; what this skill adds is the ibl.ai envelope around them — auth, credits,
ownership, and the parts that are not verbatim.

- **Voices** — list, clone, synthesize speech.
- **Avatars** — create photo or digital-twin avatar groups, poll training, list looks,
  mint a consent URL.
- **Videos** — generate, poll to completion.
- **Assets** — upload media for the above to reference.
- **Streaming** — create an interactive session, then drive a live talking avatar.

## The schema is the contract

These endpoints live on the **Data Manager** service and its live OpenAPI schema is
the single source of truth — the URLs and fields below exist for orientation and
**can drift between releases**. Validate before building requests:

- **Schema (raw):** `https://api.iblai.app/dm/api/docs/schema/`
- **Swagger UI:** `https://api.iblai.app/dm/api/docs/`

```bash
curl -sS "https://api.iblai.app/dm/api/docs/schema/" -o /tmp/iblai_schema.yaml
grep -nE "providers/heygen" /tmp/iblai_schema.yaml
```

For the *payload* shapes inside a response, HeyGen's own documentation is the source
of truth — ibl.ai passes them through unchanged.

## Auth & conventions

- **`dm_url`** = `https://api.iblai.app/dm` — these are **Data Manager** endpoints
  reached through the gateway's `/dm` prefix.
- **`base`** = `{dm_url}/api/ai-agent/orgs/{org}/users/{username}/providers/heygen/video`
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Placeholders:**
  - `{org}` = your organization key = `$IBLAI_ORG`.
  - `{username}` = the user the call acts *for*. **It must be your own username**
    unless you are an organization admin, who may act on any member's path.
- **Prefix twin:** `{dm_url}/api/ai-mentor/...` resolves to the same views. The
  `ai-agent` spelling used here is canonical; `ai-mentor` is marked deprecated in the
  generated schema but still works.
- **Upstream versions:** voices, avatars, videos and assets target HeyGen v3;
  everything under `streaming/` targets v1.
- **Responses are HeyGen's body, verbatim** — including HeyGen's `{"data": ...}`
  envelope and its sibling pagination fields (`has_more`, `next_token`). Unwrap it
  yourself. **One endpoint is not verbatim**: `streaming/knowledge-bases/` is
  flattened (see below).
- **Undeclared fields are forwarded.** Anything you send beyond the fields listed
  here is passed to HeyGen untouched, so newer HeyGen parameters work without waiting
  for ibl.ai to add them. Validation only covers the fields named here.
- Not connected yet? Run **`/iblai-api-login`** first.

## Access

Every member of the organization can use this surface on their own `{username}` path
out of the box — the default member role carries the whole family. Organization
admins reach any member's path.

The RBAC verbs, for building a custom role, resolve at resource
`/platforms/{id}/heygen/`:

| Verb | Covers |
|---|---|
| `Ibl.Mentor/Heygen/list` | `voices/`, `avatar-groups/{id}/looks/`, `streaming/knowledge-bases/`, `streaming/avatars/` |
| `Ibl.Mentor/Heygen/read` | `avatar-groups/{id}/`, `videos/{id}/` |
| `Ibl.Mentor/Heygen/action` | every `POST` in this skill |

There is no `write` or `delete` verb — creation is covered by `action`.

**Ownership gate.** Every billable create records the id it produced against the
user who made it. The routes that take an id back — `avatar-groups/{group_id}/…`,
`videos/{video_id}/`, `streaming/sessions/{session_id}/…` — return `403` when the id
belongs to someone else. Two caveats worth knowing: an admin may act on any id owned
**within their own organization** but never across organizations, and **an id with no
ownership record is allowed through**. That last one is deliberate, so ids minted
before the gate existed keep working — but it means an id that did not come from this
surface is not protected by it.

## Reads

### Voices

- **GET** `{base}/voices/?[type=public|private][&engine=][&language=][&gender=male|female][&limit=][&token=]`
  — list voices. All params optional and forwarded to HeyGen, which supplies the
  defaults. `limit` must be ≥1. `token` is the cursor from a previous page's
  `next_token`.

### Avatars

- **GET** `{base}/avatar-groups/{group_id}/` — avatar group detail. **This is the
  poll target for digital-twin training**; the training status lives in the body.
- **GET** `{base}/avatar-groups/{group_id}/looks/` — list the looks in a group.
  `group_id` comes from the path and overrides any `group_id` you send as a query
  param; every other query param is forwarded to HeyGen untouched.

### Videos

- **GET** `{base}/videos/{video_id}/` — video detail, and **the poll target for
  generation**. HeyGen's body carries `status` (`pending` | `processing` |
  `completed` | `failed`), `duration` in seconds, `created_at` / `completed_at`, and
  the output URLs once finished.

### Streaming

- **GET** `{base}/streaming/avatars/` — list the avatars available for interactive
  sessions. Verbatim.
- **GET** `{base}/streaming/knowledge-bases/` — list knowledge bases for grounding a
  session. **The one transformed response on this surface:** HeyGen returns
  `{"data": {"list": [...]}}` and ibl.ai returns `{"data": [...]}`, preserving every
  other top-level key. Write your client against the flattened shape.

## Writes

Every endpoint in this section is a `POST`. The five marked **billable** consume
credits — see *Credits* in Notes.

### Voices

- **POST** `{base}/voices/clone/` — **billable. Confirm with the user first.**
  Clone a voice from a recording.
  ```json
  {
    "voice_name": "string (required)",
    "audio": { "…": "object (required) — references an uploaded asset" },
    "language": "string",
    "remove_background_noise": false
  }
  ```
  HeyGen bills voice-clone **training** when it completes, which is well after this
  call returns.

- **POST** `{base}/voices/speech/` — **billable.** Synthesize speech from text.
  ```json
  { "voice_id": "string (required)", "text": "string (required)" }
  ```

### Avatars

- **POST** `{base}/avatar-groups/` — **billable. Confirm with the user first.**
  Create a photo or digital-twin avatar.
  ```json
  {
    "type": "digital_twin | photo (required)",
    "name": "string (required)",
    "file": { "…": "object (required) — references an uploaded asset" }
  }
  ```
  HeyGen's response nests two ids: `data.avatar_group.id` is the **group** id that
  every `avatar-groups/{group_id}/…` route below takes, and `data.avatar_item.id` is
  a *look* id. Using the look id where a group id belongs is the most common mistake
  on this surface. Digital-twin training is charged by HeyGen at completion.

- **POST** `{base}/avatar-groups/{group_id}/consent/` — mint a consent URL for a
  digital twin. Send an empty body; nothing is read or forwarded. Not billable
  despite being a `POST`.

### Videos

- **POST** `{base}/videos/` — **billable. Confirm with the user first.** Generate a
  video.

  | Field | Type | Required |
  |---|---|---|
  | `type` | `avatar` \| `image` | **yes** |
  | `avatar_id` | string | when `type` is `avatar` |
  | `image` | object | when `type` is `image` |
  | `script` | string | no |
  | `voice_id` | string | no |
  | `audio_url` | string | no |
  | `audio_asset_id` | string | no |
  | `title` | string \| null | no |

  Only `avatar` and `image` are accepted here; HeyGen's other video types are
  rejected. Exactly one audio source should be supplied — ibl.ai does not enforce
  that, HeyGen does. `engine` and `resolution` (`4k` | `1080p` | `720p`) are
  forwarded like any undeclared field and are what determine HeyGen's own per-minute
  price. Returns `data.video_id`; poll `GET {base}/videos/{video_id}/`.

### Assets

- **POST** `{base}/assets/` — upload a media file for the endpoints above to
  reference. **`multipart/form-data` only**, one part named `file`. Default cap
  **32 MiB**, configurable per organization; over-cap is a **`400`, not a `413`**.
  Not billable. Returns HeyGen's `asset_id` and `url`.

### Streaming

- **POST** `{base}/streaming/sessions/` — **billable.** Open an interactive session.
  ```json
  {
    "avatar_name": "string",
    "quality": "string",
    "voice": { "…": "object" },
    "language": "string",
    "knowledge_base_id": "string",
    "disable_idle_timeout": false,
    "activity_idle_timeout": 120
  }
  ```
  ibl.ai injects `version: "v2"`, `video_encoding: "H264"` and `source: "sdk"` when
  you omit them; anything you send wins. Returns `session_id`, `access_token` and
  `url`. **The media never touches ibl.ai** — the browser connects to LiveKit at
  `url` and opens HeyGen's chat websocket directly with `access_token`.

- **POST** `{base}/streaming/sessions/{session_id}/{action}/` — drive the session.
  `{action}` is one of exactly seven slugs: `start`, `stop`, `interrupt`,
  `keep-alive`, `start-listening`, `stop-listening`, `task`. Anything else is a `404`
  before HeyGen is called. `session_id` comes from the path and overrides any you put
  in the body. Only `task` has a validated body:
  ```json
  { "text": "string (required)", "task_type": "talk | repeat", "task_mode": "sync | async" }
  ```
  **None of the seven is billable** — deliberately, so a keep-alive can never fail
  with a payment error mid-session.
  → Full lifecycle, cadence and each action's effect: [`references/streaming.md`](references/streaming.md).

## Example

Generate an avatar video and poll it to completion:

```bash
dm_url="https://api.iblai.app/dm"
base="$dm_url/api/ai-agent/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME/providers/heygen/video"
auth="Authorization: Api-Token $IBLAI_API_KEY"

# pick a voice
curl -s "$base/voices/?limit=5" -H "$auth" | jq '.data[] | {voice_id, name}'

# generate — returns data.video_id
vid=$(curl -s -X POST "$base/videos/" -H "$auth" -H "Content-Type: application/json" \
  -d '{"type":"avatar","avatar_id":"Abigail_expressive_2024112501",
       "script":"Welcome to the course.","voice_id":"f38a635bee7a4d1f9b0a654a31d050d2",
       "resolution":"1080p","title":"welcome"}' | jq -r '.data.video_id')

# poll until terminal
while :; do
  s=$(curl -s "$base/videos/$vid/" -H "$auth" | jq -r '.data.status')
  echo "$s"; case "$s" in completed|failed) break ;; esac; sleep 5
done
```

Open a streaming session:

```bash
curl -s -X POST "$base/streaming/sessions/" -H "$auth" -H "Content-Type: application/json" \
  -d '{"avatar_name":"Wayne_20240711","quality":"high"}' \
  | jq '{session_id: .data.session_id, url: .data.url}'
# then: POST $base/streaming/sessions/<id>/start/, drive with .../task/,
# keep-alive every 60s, and .../stop/ when done.
```

## Notes

- **Credits are charged only when ibl.ai supplies the HeyGen account.** An
  organization that configures its own HeyGen key pays HeyGen directly and is never
  charged credits here. When ibl.ai's account serves the call and a price is
  configured, the five billable endpoints check the balance **before** calling HeyGen
  and return `402` if it is short. The charge is recorded after a successful call, so
  a failed call is never billed, and a failure to record a charge never turns a
  successful call into an error.
- **Reads, controls, consent and asset upload are always free** and never return
  `402`.
- **HeyGen's price is not ibl.ai's price.** HeyGen bills video by the second at a
  rate set by `engine` and `resolution`; the credit price here is a flat per-call
  figure the organization configures. They will not agree, by design.
- **A `403` on an id you did not create is the ownership gate** — use your own
  resources. A `403` on the `{username}` path segment means you are acting on someone
  else's path without being an admin.
- **Upstream auth failures surface as `502`, not `401`.** If HeyGen rejects the
  server's key you get `502`; a `401` you receive is always about *your* ibl.ai token.
  HeyGen's `503` is normalised to `429`.
- **Poll, do not wait.** Video generation, voice-clone training and digital-twin
  training are all asynchronous with no callback on this surface. Poll the matching
  detail read; 5 s is a reasonable interval.
- **`streaming/knowledge-bases/` is the only reshaped response.** Everything else is
  HeyGen's body byte for byte.
- **Interactive session time is invisible to this API.** Once a session is open the
  browser talks to LiveKit directly, so session duration is not reported back through
  any endpoint here. Send `stop` when you are done rather than abandoning the session.
- For the generic multi-provider proxy, including HeyGen actions this surface does not
  expose (translation, webhooks, talking photos, remaining quota), see
  `/iblai-api-external-service-proxy`.

## Reference material

The endpoints above are the primary; these carry the exhaustive material.

- [`references/streaming.md`](references/streaming.md) — the interactive session lifecycle end to end: all seven control actions, the LiveKit handoff, keep-alive cadence, idle timeouts and teardown.
- [`references/errors.md`](references/errors.md) — every status, the condition behind it, the upstream-to-ibl.ai status translation, and the full `402` body.