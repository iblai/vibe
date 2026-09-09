# External Service Proxy — ElevenLabs action catalog

Reference for the **ElevenLabs** service behind `/iblai-api-external-service-proxy`.
Invoke any action with `POST …/dm/api/ai-proxy/orgs/{org}/services/elevenlabs/{action}/`
plus the request envelope — see the skill's **Concepts** (the envelope, `request_mode` /
`response_mode`, `path_template`) for how the columns below map onto your request. Every
invoke is an HTTP `POST` to the gateway regardless of the *upstream* method shown here.

- Upstream base `https://api.elevenlabs.io`; the org's key is injected server-side as the
  header `xi-api-key` (clients never hold it).
- **Confirm with the user first** — billable: `tts`, `tts-stream`, `tts-timestamps`,
  `sound-generation`, `audio-isolation`, `audio-isolation-stream`, `create-dubbing`.
  Destructive: `delete-voice`, `delete-dubbing`, `delete-history-item`.

| action | upstream method + path_template | req→resp | path_params · notes |
|--------|--------------------------------|----------|---------------------|
| `list-voices` | GET `/v1/voices` | raw→json | — |
| `get-voice` | GET `/v1/voices/{voice_id}` | raw→json | `voice_id` |
| `add-voice` | POST `/v1/voices/add` | multipart→json | multipart file upload |
| `edit-voice` | POST `/v1/voices/{voice_id}/edit` | multipart→json | `voice_id` · file upload |
| `delete-voice` | DELETE `/v1/voices/{voice_id}` | raw→json | `voice_id` · destructive |
| `get-voice-settings` | GET `/v1/voices/{voice_id}/settings` | raw→json | `voice_id` |
| `list-models` | GET `/v1/models` | raw→json | — |
| `tts` | POST `/v1/text-to-speech/{voice_id}` | json→passthrough | `voice_id` · **audio/mpeg bytes**, billable |
| `tts-stream` | POST `/v1/text-to-speech/{voice_id}/stream` | json→stream | `voice_id` · streamed audio, billable |
| `tts-timestamps` | POST `/v1/text-to-speech/{voice_id}/with-timestamps` | json→json | `voice_id` · audio+timings JSON, billable |
| `sound-generation` | POST `/v1/sound-generation` | json→passthrough | audio bytes, billable |
| `audio-isolation` | POST `/v1/audio-isolation` | multipart→passthrough | audio bytes, billable · file upload |
| `audio-isolation-stream` | POST `/v1/audio-isolation/stream` | multipart→stream | billable · file upload |
| `create-dubbing` | POST `/v1/dubbing` | multipart→json | poll `get-dubbing`, billable · file upload |
| `get-dubbing` | GET `/v1/dubbing/{dubbing_id}` | raw→json | `dubbing_id` |
| `get-dubbed-audio` | GET `/v1/dubbing/{dubbing_id}/audio/{language_code}` | raw→passthrough | `dubbing_id`, `language_code` · audio bytes |
| `delete-dubbing` | DELETE `/v1/dubbing/{dubbing_id}` | raw→json | `dubbing_id` · destructive |
| `get-history` | GET `/v1/history` | raw→json | — |
| `get-history-item` | GET `/v1/history/{history_item_id}` | raw→json | `history_item_id` |
| `get-history-audio` | GET `/v1/history/{history_item_id}/audio` | raw→passthrough | `history_item_id` · audio bytes |
| `delete-history-item` | DELETE `/v1/history/{history_item_id}` | raw→json | `history_item_id` · destructive |
| `get-user` | GET `/v1/user` | raw→json | — |
| `get-subscription` | GET `/v1/user/subscription` | raw→json | quota / plan |

**`tts` body** (path_params.`voice_id` required, from `list-voices`):

| field | required | notes |
|-------|----------|-------|
| `text` | yes | text to synthesize |
| `model_id` | yes | model id from `list-models` (e.g. `eleven_multilingual_v2`) |
| `voice_settings` | no | `{stability, similarity_boost, …}`; each `0.0`–`1.0` |

**List-read response shapes** — where the ids come from:

- `list-voices` → `{ "voices": [ { "voice_id", "name", "category", "labels": { "accent", "gender" } } ] }` — wrapped in a top-level `voices` array.
- `list-models` → a **bare JSON array** `[ { "model_id", "name", "description" } ]` — not wrapped.

`tts` response is `Content-Type: audio/mpeg` (binary MP3) — the `passthrough` bytes; write to a file, don't JSON-parse.
