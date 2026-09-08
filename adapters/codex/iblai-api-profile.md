# iblai-api-profile

> Read and manage the signed-in user's own profile via the platform API — basic account info, social links, education, experience, résumé, and memory. Use for self-service profile management. (For the user's learning analytics, see /iblai-api-analytics.)

# iblai-api-profile

Manage the signed-in user's own profile via the API: their basic account info,
social links, education, experience, résumé, and memory. The signed-in user
manages their **own** profile. (To manage an *agent's* memories from the admin
side, use `/iblai-api-agent-memory`.)

## Auth & conventions

- **Base URL:** `https://api.iblai.app`
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG`, `{username}` = `$IBLAI_USERNAME`.
- **Hosts:** Basic/Social are on the **LMS** host (`…/lms/api/…`); Education,
  Experience, and Resume are **career** endpoints on **DM** (`…/dm/api/career/…`).
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Reads

### Basic & Social

Basic fields (full name, email, title, about, language) and social links are the
user's account record.

- **GET** `https://api.iblai.app/lms/api/user/v1/accounts/{username}` — account: `name`, `email`, `bio` (about text), `language_proficiencies`, `social_links`, profile image.
- **GET** `https://api.iblai.app/lms/api/ibl/users/manage/metadata/?username={username}` — extended profile metadata (e.g. title).

### Education

- **GET** `https://api.iblai.app/dm/api/career/orgs/{org}/education/users/{username}/` — list education records.

### Experience

- **GET** `https://api.iblai.app/dm/api/career/orgs/{org}/experience/users/{username}/` — list experience records.

### Resume

- **GET** `https://api.iblai.app/dm/api/career/resume/orgs/{org}/users/{username}/` — fetch resume + media files.

### Memory

Memory covers two personalization flags plus the user's auto-extracted
memories:

- **Allow AI to learn from conversations** and **use saved information in
  responses** — personalization flags stored on the user's account
  (persist via the account/metadata endpoints above).
- The user's own memories (auto-extracted, with the option to add new ones).
  These are the same memory objects the admin side manages; see
  **`/iblai-api-agent-memory`** for the memory CRUD endpoints
  (`…/mentors/{mentor}/mentor-memories/`), here scoped to the signed-in user.

## Writes

### Basic & Social

- **PATCH** `https://api.iblai.app/lms/api/user/v1/accounts/{username}` — update basic/social fields (`Content-Type: application/merge-patch+json`; send only changed keys):
  ```json
  {
    "name": "string",
    "bio": "string",
    "language_proficiencies": [{ "code": "en" }],
    "social_links": [{ "platform": "linkedin", "social_link": "https://…" }]
  }
  ```

### Education

- **POST** `…/dm/api/career/orgs/{org}/education/users/{username}/` — create an education entry.
- **PUT** `…/dm/api/career/orgs/{org}/education/users/{username}/` — update an entry (body includes its `id`).
- **GET / POST / PUT** `…/dm/api/career/orgs/{org}/institutions/users/{username}/` — institutions (the schools referenced by education records).

### Experience

- **POST** `…/dm/api/career/orgs/{org}/experience/users/{username}/` — create an experience entry.
- **PUT** `…/dm/api/career/orgs/{org}/experience/users/{username}/` — update an entry (body includes its `id`).
- **GET / POST / PUT** `…/dm/api/career/orgs/{org}/companies/users/{username}/` — companies (the employers referenced by experience records).

### Resume

- **POST** `…/dm/api/career/resume/orgs/{org}/users/{username}/` — upload a resume (`multipart/form-data`).
- **PUT** `…/dm/api/career/resume/orgs/{org}/users/{username}/` — replace the resume (`multipart/form-data`).

## Example

Update the user's about text and add a LinkedIn social link:

```bash
curl -X PATCH \
  "https://api.iblai.app/lms/api/user/v1/accounts/$IBLAI_USERNAME" \
  -H "Authorization: Api-Token $IBLAI_API_KEY" \
  -H "Content-Type: application/merge-patch+json" \
  -d '{"bio": "CTO at ibl.ai.", "social_links": [{"platform": "linkedin", "social_link": "https://www.linkedin.com/in/example"}]}'
```

## Notes

- Basic/social fields are the edX-style account record (LMS host) and update via
  **PATCH** with `application/merge-patch+json` — send only changed keys.
- Career endpoints (education / experience / résumé / institutions / companies)
  are DM-hosted under `…/dm/api/career/…`; résumé uploads require
  `multipart/form-data`.
- This skill is the user's own profile data. The user's own learning
  **analytics** (enrollments, grades, time spent) live in `/iblai-api-analytics`
  under its User-analytics section.