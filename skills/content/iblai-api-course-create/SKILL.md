---
name: iblai-api-course-create
description: Programmatically generate, edit, and publish courses via the ibl.ai Course Creation API — create a task, generate an AI outline, run the full creation pipeline, then read the course outline, full structure, and draft unit content. Use to author courses from the API.
metadata:
  kind: api
---

# iblai-api-course-create

Generate, edit, and publish courses through the ibl.ai Course Creation API:
spin up a task, let AI generate a course outline, run the full creation
pipeline, then read the resulting outline, full structure, and draft unit
content. Host root for every endpoint below is
`…/dm/api/ai-mentor/orgs/{org}/users/{username}/course-creation/`.

## Auth & conventions

- **Base URL:** `https://api.iblai.app`
- **Header:** `Authorization: Api-Token $IBLAI_API_KEY` on every request.
- **Path vars:** `{org}` = `$IBLAI_ORG`, `{username}` = `$IBLAI_USERNAME`,
  `{task_id}` = a course-creation task's id, `{course_id}` = a created course's id.
- **Host root:** `…/dm/api/ai-mentor/orgs/{org}/users/{username}/course-creation/`.
- Not connected yet? Run **`/iblai-api-login`** first to populate `IBLAI_ORG`,
  `IBLAI_USERNAME`, and `IBLAI_API_KEY`.

## Reads

### Tasks

- **GET** `…/course-creation/tasks/` — list tasks.
- **GET** `…/course-creation/tasks/{task_id}/` — task detail / status (status flows `Pending` → `Scheduled`).
- **GET** `…/course-creation/tasks/{task_id}/start/` — start the full creation pipeline.
- **GET** `…/course-creation/tasks/{task_id}/cancel/` — cancel the pipeline.

### Courses

- **GET** `…/course-creation/course/` — list courses (filter by task with `?task={task_id}`).
- **GET** `…/course-creation/course/{course_id}/` — course detail.
- **GET** `…/course-creation/course/{course_id}/outline/` — outline (no component content).
- **GET** `…/course-creation/course/{course_id}/full-structure/` — full structure (add `?include_content=true` for HTML).
- **GET** `…/course-creation/course/{course_id}/draft-content-for-all-units/` — draft content for all units.

## Writes

### Tasks

- **POST** `…/course-creation/tasks/` — create a task.
- **DELETE** `…/course-creation/tasks/{task_id}/` — delete a task. Destructive — confirm with the user first.
- **POST** `…/course-creation/tasks/{task_id}/create-course/` — create the course on the LMS.
- **POST** `…/course-creation/tasks/{task_id}/create-course-outline/` — generate the outline with AI.

### Courses

- **DELETE** `…/course-creation/course/{course_id}/` — delete the course record. Destructive — confirm with the user first.
- **POST** `…/course-creation/course/{course_id}/draft-content-for-unit/` — draft content for one unit.

## Example

Generate the AI outline for an existing task:

```bash
curl -X POST \
  "https://api.iblai.app/dm/api/ai-mentor/orgs/$IBLAI_ORG/users/$IBLAI_USERNAME/course-creation/tasks/$TASK_ID/create-course-outline/" \
  -H "Authorization: Api-Token $IBLAI_API_KEY"
```

## Notes

- Typical flow: create task → generate outline (AI) → start pipeline → read
  `full-structure/` / draft content.
- Task status flows `Pending` → `Scheduled`; poll `…/tasks/{task_id}/` to track
  progress, and `…/tasks/{task_id}/cancel/` to stop a running pipeline.
- `full-structure/` returns the structure without HTML by default — add
  `?include_content=true` to include rendered component content.
- List courses for a given task with `…/course/?task={task_id}`.
