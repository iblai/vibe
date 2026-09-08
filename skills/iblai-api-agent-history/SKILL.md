---
name: iblai-api-agent-history
description: Read an ibl.ai agent's conversation history and summaries via the platform API — list conversations with sentiment/topic/user/date filters, get general summaries and per-conversation memory, and export chat history as an async report. Use when reviewing or exporting how users have chatted with an agent.
metadata:
  kind: api
---

# iblai-api-agent-history

Read an agent's conversation history and summaries through the API: list the
conversations users have had with an agent (filterable by sentiment, topic,
user, and date), read the general summary and per-conversation memory, and
export the full chat history as a report. Use when reviewing or exporting how
users have chatted with an agent.

## Auth & conventions

- **Base URL:** `https://api.iblai.app`
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG`, `{username}` = `$IBLAI_USERNAME`,
  `{mentor}` = the agent's unique id (e.g. `d17dc729-60fd-4363-81a0-f67d9318b03e`).
- **Conversation reads** go through the AI-analytics host —
  paths under `…/dm/api/ai-analytics/…`.
- **Export** goes through the **reports** endpoints (`…/dm/api/reports/…`) and is
  **async**: a **POST** creates the report, then you **GET**-poll until the
  download URL is ready.
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Reads

- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/mentors/{mentor}/public-settings/` — gating (whether history is available for this agent).
- **GET** `https://api.iblai.app/dm/api/ai-analytics/orgs/{org}/users/{username}/chat-history/?mentor={mentor}&page={n}&page_size=10&sentiment={s}&topics={t}&filter_user_id={id}&start_date={d}&end_date={d}` — conversation list (paginated; sentiment / topics / user / date filters).
- **GET** `https://api.iblai.app/dm/api/ai-analytics/orgs/{org}/users/{username}/chat-history-filter/?mentor_id={mentor}&monthly_range=false&start_date=&end_date=` — available filter options (sentiments, topics, users).
- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/mentors/{mentor}/summaries/general/` — general summary, average rating, and topics.
- **GET** `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/memory/{conversationId}/` — per-conversation memory.

## Writes

### Export

Export is async — **POST** to create the report, then **GET**-poll until the
download URL appears.

- **POST** `https://api.iblai.app/dm/api/reports/platforms/{org}/new` — create an export report:
  ```json
  {
    "report_name": "ai-mentor-chat-history (required)",
    "mentor": "uuid",
    "usergroup_ids": "number[]",
    "start_date": "yyyy-MM-dd",
    "end_date": "yyyy-MM-dd",
    "sentiment": "string",
    "topics": "string",
    "source": "origin url"
  }
  ```
- **GET** `https://api.iblai.app/dm/api/reports/platforms/{org}/{report_name}?mentor_unique_id={mentor}` — poll / download the report (repeat until the download URL is ready).

## Example

List the most recent positive-sentiment conversations for an agent:

```bash
curl -s \
  "https://api.iblai.app/dm/api/ai-analytics/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME/chat-history/?mentor=$MENTOR&page=1&page_size=10&sentiment=positive" \
  -H "Authorization: Api-Token $IBLAI_API_KEY"
```

## Notes

- The conversation list is paginated — pass `page` and keep `page_size=10`;
  omit filter params you are not using.
- Discover valid `sentiment` / `topics` / user values from the
  `chat-history-filter/` endpoint before filtering the list.
- Export does not return a file directly — POST returns a report handle, then
  the GET poll returns the download URL once generation finishes.
