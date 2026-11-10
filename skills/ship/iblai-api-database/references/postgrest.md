# PostgREST through the proxy

`…/databases/{name}/rest/v1/{object}` relays a PostgREST request as is. This is
the subset you will reach for; the full reference is
[postgrest.org](https://docs.postgrest.org/en/stable/references/api.html).
Everything below goes in the query string unless it says *header*.

## Reading

| Want | Query string |
|---|---|
| Some columns | `select=id,email,created_at` |
| Rename a column | `select=id,mail:email` |
| Cast a column | `select=score::int,created_at::date` — plain types only (`text`, `int`, `bigint`, `numeric`, `float`, `boolean`, `date`, `timestamptz`, `uuid`, `json`, `jsonb`…); anything else is `400` from the platform |
| Rows of a related object (a `RELATION` field) | `select=*,companies(*)` or `select=id,companies(id,name)` |
| Equality / inequality | `stage=eq.Lead`, `stage=neq.Lost` |
| Comparison | `score=gt.100`, `score=gte.100`, `score=lt.5`, `score=lte.5` |
| Pattern | `email=like.*@example.com`, `email=ilike.*JANE*` (case-insensitive) |
| In a list | `stage=in.(Lead,Won)`, `email=in.("a@x.io","b@x.io")` |
| Array column (a `MULTI_SELECT`) | `tags=cs.{a,b}` (contains), `tags=ov.{a,b}` (overlaps) |
| Null checks | `company=is.null`, `company=not.is.null` |
| Negation | `stage=not.eq.Lead` |
| Either / both | `or=(stage.eq.Lead,stage.eq.Won)`, `and=(score.gt.10,score.lt.100)` |
| JSON column path | `extra->>city=eq.Lagos` |
| Order | `order=created_at.desc`, `order=last_name.asc,first_name.asc`, `order=score.desc.nullslast` |
| Page | `limit=20&offset=40` — or the *header* `Range: 40-59` with `Range-Unit: items` |
| Total count | *header* `Prefer: count=exact` → `Content-Range: 40-59/312` (`count=estimated` / `count=planned` are cheaper on big tables) |
| Exactly one row as an object | *header* `Accept: application/vnd.pgrst.object+json` → `PGRST116` unless exactly one row matches |
| CSV | *header* `Accept: text/csv` |

Filters combine with `&`. Values with commas, parentheses or quotes go in
double quotes: `name=eq."Doe, Jane"`. A raw `;` anywhere in the query string is
`400` from the platform (PostgREST would read it as a separator): send `%3B`.

## Writing

| Want | Request |
|---|---|
| Insert one | `POST` `{object}` with a JSON object; `201` |
| Insert many | `POST` with a JSON array — all or nothing |
| Get the rows back | *header* `Prefer: return=representation` (default is `return=minimal`, empty body) |
| Upsert | `POST` + *header* `Prefer: resolution=merge-duplicates` (`on_conflict=email` in the query string for a unique field that is not `id`) |
| Ignore duplicates | `POST` + *header* `Prefer: resolution=ignore-duplicates` |
| Update | `PATCH` `{object}?id=eq.<uuid>` with the changed columns; `204` |
| Update several | `PATCH` `{object}?stage=eq.Lead` — **every row the filter selects** |
| Replace one row | `PUT` `{object}?id=eq.<uuid>` with the full row (`id` must be in both the filter and the body) |
| Delete | `DELETE` `{object}?id=eq.<uuid>`; `204` — an unfiltered `DELETE` (or `PATCH`) is refused, `21000` |
| Deleted rows back | `DELETE` + *header* `Prefer: return=representation` |
| Missing columns on insert | *header* `Prefer: missing=default` applies column defaults instead of `null` |

Writes return `Content-Range` with `return=representation`, and it is
relayed. PostgREST's `Location` is not, because it points at PostgREST's own
root: ask for `return=representation` to get the new row back. A `SELECT` or
`MULTI_SELECT` value must be one of the field's options exactly (`22P02`
otherwise); a `RELATION` value is the target row's `id`.

## Headers that matter

Forwarded from your request: `Accept`, `Content-Type`, `Prefer`, `Range`,
`Range-Unit`. Set by the platform and not yours to change: `Accept-Profile`,
`Content-Profile` (the database's schema), `Authorization` upstream (a
60-second token for the caller). Anything else is dropped.

Relayed from PostgREST's response: `Content-Type`, `Content-Range`,
`Preference-Applied`, `Content-Location`. Every relayed response also carries
`Content-Security-Policy: default-src 'none'; sandbox`, so a body never runs as
a page; API clients ignore it.

## Errors

PostgREST answers JSON `{"code", "message", "details", "hint"}` with its own
status, and the proxy passes both through.

| Code | Status | Meaning |
|---|---|---|
| `PGRST205` | 404 | No such object in this database — a typo, or the schema cache has not caught up with an object created a moment ago |
| `PGRST204` | 400 | No such column — a typo, or a field added a moment ago |
| `42501` | 403 or 401 | Permission denied — a write the role cannot make |
| `21000` | 400 | `UPDATE` / `DELETE requires a WHERE clause` — add a filter |
| `57014` | 500 | The statement ran past 8 s |
| `42703` | 400 | No such column in a filter or `order` |
| `23505` | 409 | Unique violation |
| `23503` | 409 | Foreign-key violation — a `RELATION` value that is nobody's `id` |
| `22P02` | 400 | Bad value for the column type, an option that is not one of the field's included |
| `PGRST100` | 400 | Could not parse the query string (an operator typo such as `=eq` without a value) |
| `PGRST102` | 400 | Could not parse the body as JSON |
| `PGRST116` | 406 | `Accept: …object+json` and the filter matched zero or several rows |

A `400` for a path other than `{object}`, for a cast outside the plain types or
a raw `;` in the query string, a `403` with `{"error": "Permission denied"}` or
`iblai-org` naming another organization, a `404` with a database name, `411`,
`413` with `{"error": "Body larger than … bytes"}`, `507` (storage quota), `502`
and `503` come from the Data Manager, before anything reached PostgREST. One
is its answer after it: a `503` for a database created a moment ago that
PostgREST does not serve yet (retry it).
