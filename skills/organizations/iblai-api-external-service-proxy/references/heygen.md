# External Service Proxy — HeyGen action catalog

Reference for the **HeyGen** service behind `/iblai-api-external-service-proxy`.
Invoke any action with `POST …/dm/api/ai-proxy/orgs/{org}/services/heygen/{action}/`
plus the request envelope — see the skill's **Concepts** (the envelope, `request_mode` /
`response_mode`, `path_template`, `callback_mode: poll`) for how the columns below map onto
your request. Every invoke is an HTTP `POST` to the gateway regardless of the *upstream*
method shown here.

- Upstream base `https://api.heygen.com`; the org's key is injected server-side as the
  header `X-API-KEY`. `service_type: async` (120 s timeout).
- **Confirm with the user first** — billable: `generate-video`, `generate-template-video`,
  `generate-talking-photo`, `translate-video`, `create-photo-avatar`. Destructive:
  `delete-video`, `delete-webhook`.

| action | upstream method + path_template | req→resp | path_params · notes |
|--------|--------------------------------|----------|---------------------|
| `list-templates` | GET `/v2/templates` | raw→json | — |
| `get-template` | GET `/v2/template/{template_id}` | raw→json | `template_id` |
| `generate-template-video` | POST `/v2/template/{template_id}/generate` | json→json | `template_id` · poll `video-status`, billable |
| `list-avatars` | GET `/v2/avatars` | raw→json | — |
| `list-voices` | GET `/v2/voices` | raw→json | — |
| `generate-video` | POST `/v2/video/generate` | json→json | poll `video-status`, billable |
| `video-status` | GET `/v1/video_status.get` | raw→json | `query.video_id` |
| `list-videos` | GET `/v1/video.list` | raw→json | — |
| `delete-video` | GET `/v1/video.delete` | raw→json | `query.video_id` · destructive |
| `translate-video` | POST `/v2/video_translate` | json→json | poll `translation-status`, billable |
| `translation-status` | GET `/v2/video_translate/{video_translate_id}` | raw→json | `video_translate_id` |
| `upload-asset` | POST `/v1/asset` | binary→json | raw file body · via `upload.heygen.com` |
| `get-asset` | GET `/v1/asset/{asset_id}` | raw→json | `asset_id` |
| `create-photo-avatar` | POST `/v2/photo_avatar` | json→json | poll `photo-avatar-train-status`, billable |
| `photo-avatar-train-status` | GET `/v2/photo_avatar/{photo_avatar_id}` | raw→json | `photo_avatar_id` |
| `generate-talking-photo` | POST `/v2/video/talking_photo` | json→json | poll `video-status`, billable |
| `list-talking-photos` | GET `/v1/talking_photo.list` | raw→json | — |
| `get-remaining-quota` | GET `/v2/user/remaining_quota` | raw→json | remaining credits |
| `add-webhook` | POST `/v1/webhook/endpoint.add` | json→json | — |
| `list-webhooks` | GET `/v1/webhook/endpoint.list` | raw→json | — |
| `delete-webhook` | DELETE `/v1/webhook/endpoint.delete` | json→json | destructive |

**`generate-video` body** → returns `data.video_id`, then poll `video-status`:

| field | required | notes |
|-------|----------|-------|
| `test` | no | `true` = test mode, no credits charged |
| `video_inputs[]` | yes | one per clip |
| `video_inputs[].character` | yes | `{type:"avatar", avatar_id, avatar_style}` (`avatar_id` from `list-avatars`) |
| `video_inputs[].voice` | yes | `{type:"text", input_text, voice_id}` (`voice_id` from `list-voices`) |
| `dimension` | yes | `{width, height}` in pixels |

**`generate-template-video` body** (path_params.`template_id` from `list-templates`)
→ returns `data.video_id`:

| field | required | notes |
|-------|----------|-------|
| `test` | no | `true` = test mode, no credits charged |
| `caption` | no | enable/disable captions |
| `variables` | yes | template variables, e.g. `{"script":{"name":"script","type":"text","properties":{"content":"…"}}}` |

**`video-status`** returns `data.status` = `processing` | `completed` (+`video_url`)
| `failed` (+`error`).

**List-read response shapes** — HeyGen wraps every payload under a top-level `data`:

- `list-templates` → `data.templates[]` = `{ "template_id", "name" }`.
- `list-avatars` → `data.avatars[]` = `{ "avatar_id", "avatar_name" }` (note `avatar_name`, not `name`).
- `list-voices` → `data.voices[]` = `{ "voice_id", "name", "language" }`.
- `generate-video` / `generate-template-video` → `data.video_id` (feed it to `video-status`).

Because of that wrapper, read every upstream field as `resp.data.<field>` (e.g. `data.avatars`, `data.video_id`, `data.status`). See the integration guide's async-polling example for the generate → poll loop.
