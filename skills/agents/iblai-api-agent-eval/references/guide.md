> Companion to [`/iblai-api-agent-eval`](../SKILL.md), which carries the full
> endpoint specs (method, path, body) and the async / pagination / grading-path
> concepts. This adds only what SKILL.md doesn't: the run pipeline as ordered
> steps, judge-rubric guidance, and CSV limits/columns. Path shorthand `…` = the
> evaluations root
> `https://api.iblai.app/dm/api/ai-mentor/orgs/{org}/users/{username}/evaluations`;
> send `Authorization: Api-Token $IBLAI_API_KEY` on every call.

# Evaluation guide

## Pipeline

Steps that dispatch work (3, and the judge in 5) return `202` with a task
record — poll, don't block. Full field lists live in SKILL.md's **Schema**.

1. **Create dataset** — `POST …/datasets/` — `{ "name": "qa-eval-v1" }`
2. **Add items** — one method per request:
   - JSON — `POST …/datasets/qa-eval-v1/items/` — `{ "items": [{ "input": "Q", "expected_output": "A" }] }`
   - CSV — `POST …/datasets/qa-eval-v1/items/upload/` — multipart `file` (see **CSV format**)
   - From chat traces — `POST …/datasets/qa-eval-v1/items/` — `{ "trace_ids": ["t1", "t2"] }`
3. **Run experiment** — `POST …/datasets/qa-eval-v1/runs/` — `{ "mentor_unique_id": "…", "run_name": "run-v1" }`. Each item gets its own chat session; the agent's reply and its trace are recorded per item — those `trace_id`s are what scores attach to.
4. **Poll to completion** — `GET …/datasets/qa-eval-v1/runs/run-v1/` until `status` is `completed`. Required before grading or export.
5. **Grade** — human and/or judge:
   - Human — `POST …/scores/` — `{ "trace_id": "t1", "name": "accuracy", "value": 4.0, "data_type": "NUMERIC" }`
   - Judge — `POST …/datasets/qa-eval-v1/runs/run-v1/evaluate/` — see **Judge criteria**
6. **View scores** — `GET …/scores/?dataset_run_id=<run-id>`
7. **Export** — `GET …/datasets/qa-eval-v1/runs/run-v1/export/` — CSV (see **CSV format**)

## Judge criteria

`criteria` is a free-text rubric — the judge grades each item's actual output
against its input and expected output, scoring **0 to 1**. Spell out every
dimension you care about and how to weight them; vague criteria give noisy
scores.

```json
{
  "criteria": "Grade on:\n1. Accuracy — is it factually correct?\n2. Completeness — does it fully address the question?\n3. Clarity — is it clear and well-structured?\nWeight accuracy most heavily.",
  "score_name": "quality"
}
```

The judge writes one score per item under `score_name`, with its reasoning in
each score's `comment`. Results land under the run — fetch them with
`GET …/scores/?dataset_run_id=<run-id>`.

## CSV format

**Upload** (`…/items/upload/`) — UTF-8, header row, `input` column **required**,
`expected_output` optional and may be blank. Limits: **10 MB**, **10,000 rows**;
rows with an empty `input` are skipped. Both bulk adds (JSON `items` and this CSV
upload) return a `created` count; for CSV, compare it against your row count to
see how many rows were skipped.

```csv
input,expected_output
What is machine learning?,A subset of AI that learns from data.
Explain neural networks,
```

**Export** (`…/runs/{run_name}/export/`) — one row per dataset item:

| Column | Description |
|---|---|
| `item_id` | Dataset item ID |
| `input` | Question sent to the agent |
| `expected_output` | Expected answer, if provided |
| `actual_output` | Agent's response |
| `trace_id` | Trace for the interaction |
| `score_<name>` | One column per score name (e.g. `score_accuracy`) |
