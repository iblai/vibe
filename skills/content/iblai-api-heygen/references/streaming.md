# Interactive streaming sessions

A streaming session is a live talking avatar: ibl.ai mints the session and the
token, and the browser then carries the audio and video itself. Understanding where
ibl.ai is and is not in the path is the whole of this reference.

`base` = `{dm_url}/api/ai-agent/orgs/{org}/users/{username}/providers/heygen/video`

## Lifecycle

```
1. POST {base}/streaming/sessions/            -> session_id, access_token, url
2. browser  --LiveKit WebRTC-->  url          (ibl.ai is NOT in this path)
   browser  --chat websocket-->  HeyGen       (ibl.ai is NOT in this path)
3. POST {base}/streaming/sessions/{id}/start/
4. drive:  task / interrupt / start-listening / stop-listening
5. POST .../keep-alive/  every 60 seconds, for as long as the session is open
6. POST {base}/streaming/sessions/{id}/stop/
```

Step 1 is billable. Steps 3–6 never are.

## 1. Create

**POST** `{base}/streaming/sessions/`

| Field | Type | Notes |
|---|---|---|
| `avatar_name` | string | From `GET {base}/streaming/avatars/`. |
| `quality` | string | HeyGen's own quality tiers. |
| `voice` | object | Forwarded as sent. |
| `language` | string | |
| `knowledge_base_id` | string | From `GET {base}/streaming/knowledge-bases/`. |
| `disable_idle_timeout` | boolean | Turns off HeyGen's idle close entirely. |
| `activity_idle_timeout` | integer | Seconds of silence before HeyGen closes the session. |

Three values are injected when you omit them, and yours win if you send them:
`version: "v2"`, `video_encoding: "H264"`, `source: "sdk"`.

The response is HeyGen's, carrying `session_id`, `access_token` and `url`.

## 2. The handoff

`access_token` is a HeyGen credential scoped to that one session. The browser uses
it to join the LiveKit room at `url` and to open HeyGen's chat websocket. **No media
passes through ibl.ai**, which has three consequences worth designing around:

- Session duration is not observable from any endpoint in this skill. If you need to
  know how long a session ran, time it client-side.
- A network problem between the browser and HeyGen will not surface as an error on
  any ibl.ai endpoint.
- The token is a live credential. Treat it like one: it belongs in the browser that
  opened the session and nowhere else.

## 3–6. Control actions

**POST** `{base}/streaming/sessions/{session_id}/{action}/`

`{action}` must be exactly one of these seven slugs. Anything else returns `404`
before HeyGen is contacted, so a typo fails fast and costs nothing.

| Slug | Effect |
|---|---|
| `start` | Begins the session. Nothing is rendered until this lands. |
| `task` | Sends text for the avatar to speak. The only slug with a validated body. |
| `interrupt` | Cuts the avatar off mid-utterance. |
| `start-listening` | Puts the avatar into listening mode. |
| `stop-listening` | Takes it out of listening mode. |
| `keep-alive` | Resets HeyGen's idle timer. |
| `stop` | Ends the session. |

`session_id` is read from the path and injected into the forwarded body, overriding
any `session_id` you include yourself.

### `task` body

```json
{
  "text": "string (required)",
  "task_type": "talk | repeat",
  "task_mode": "sync | async"
}
```

`talk` runs the text through the avatar's model; `repeat` speaks it verbatim.
`sync` waits for the utterance to finish, `async` returns immediately.

### The other six

Whatever JSON object you send is forwarded unvalidated. A non-object body is
forwarded as an empty object. In practice send `{}`.

## Keep-alive cadence

**Every 60 seconds** while the session is open. Without it HeyGen closes the session
after `activity_idle_timeout`, or roughly 2 minutes if you did not set one, unless
you created the session with `disable_idle_timeout`.

Keep-alive is deliberately not billable. That is a design decision, not an
oversight: a billable keep-alive could fail with `402` in the middle of a live
conversation and drop the session, so the cost of holding a session open is never
charged per-beat.

## Teardown

Send `stop` when you are finished. A session abandoned without `stop` is treated as
having ended at its last control action plus the idle timeout, which is a worse
estimate than the real thing for anything that meters session time.

## Failure modes

| What you see | What it means |
|---|---|
| `404` on a control call | The action slug is not one of the seven. Check the spelling — it is `keep-alive`, not `keep_alive`. |
| `403` on a control call | The `session_id` was created by someone else. Sessions are owned by the user who opened them. |
| `429` on create | HeyGen is rate-limiting, **or** the account is at its concurrent-session limit. Both arrive as `429`. |
| `402` on create | The credit balance is short. Only create can return this; no control action ever will. |
| `502` on any call | HeyGen rejected the server's key or was unreachable. Not something the caller can fix by retrying immediately. |

## Worked sequence

```bash
base="$dm_url/api/ai-agent/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME/providers/heygen/video"
auth="Authorization: Api-Token $IBLAI_API_KEY"

s=$(curl -s -X POST "$base/streaming/sessions/" -H "$auth" \
     -H "Content-Type: application/json" \
     -d '{"avatar_name":"Wayne_20240711","quality":"high","activity_idle_timeout":180}')
sid=$(jq -r '.data.session_id' <<<"$s")

# hand .data.url and .data.access_token to the browser here

curl -s -X POST "$base/streaming/sessions/$sid/start/" -H "$auth" -d '{}'

curl -s -X POST "$base/streaming/sessions/$sid/task/" -H "$auth" \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, welcome to the lesson.","task_type":"talk","task_mode":"sync"}'

# background: every 60s
# curl -s -X POST "$base/streaming/sessions/$sid/keep-alive/" -H "$auth" -d '{}'

curl -s -X POST "$base/streaming/sessions/$sid/stop/" -H "$auth" -d '{}'
```
