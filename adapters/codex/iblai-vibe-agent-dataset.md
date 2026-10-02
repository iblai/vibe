# iblai-vibe-agent-dataset

> Add the agent Datasets tab (the agent's knowledge base -- add files, URLs, YouTube, GitHub, cloud drives or a web crawl; train, untrain, retrain on a schedule, change visibility, delete) to your Next.js app. Use when the user mentions agent datasets, training data, knowledge base, RAG, uploading documents to an agent, or retraining. For the REST contract see /iblai-api-agent-dataset.

# /iblai-vibe-agent-dataset

Add the agent **Datasets tab** -- the agent's knowledge base. **Scope: per
agent.** Each resource is a training document attached to the agent, and the
agent answers from every trained document for every user who chats with it.
The tab is a searchable table (five rows per page) with an **Add Resource**
button that opens the SDK's own resource picker. This is one tab in the
agent-settings family indexed by `/iblai-vibe-agent`; it shares the
`AgentSettingsProvider` wrapper with every other tab.

**Datasets** -- name (links to the source), type, tokens, retrain interval,
visibility, and a training switch. **Add Resource** shows only when the user
holds the create grant on the agent's documents (Step 2).

![Datasets tab -- table](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-dataset/iblai-vibe-agent-dataset-1-datasets.png)

**Add Resources** -- one tile per source: PowerPoint, OneDrive, Google Drive,
Dropbox, YouTube, URL, PDF, DOCX, Excel, CSV, GitHub, TXT, Markdown, Audio,
Video, Image, Web Crawler, ZIP, Course. Hide tiles with
`disabledResourceTypes`.

![Datasets tab -- Add Resources](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-dataset/iblai-vibe-agent-dataset-2-add-resource.png)

**Source dialog** -- each tile opens its own dialog (here **URL**). **Submit**
queues the resource ("Document has been queued for training"); the row shows
"In progress" until training finishes.

![Datasets tab -- URL dialog](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-dataset/iblai-vibe-agent-dataset-3-url.png)

**Schedule Retraining** -- the clock in **Interval** opens a retrain schedule
(daily, weekly, monthly, or a custom number of days). It is enabled only for
trained documents that can be re-fetched (URLs, YouTube, GitHub, crawls);
uploaded files and cloud-drive documents cannot be retrained.

![Datasets tab -- Schedule Retraining](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-dataset/iblai-vibe-agent-dataset-4-retrain.png)

**Untrain, then delete** -- switching a trained row off untrains it and then
offers **Delete Dataset**. Switching an untrained row on asks whether to
**Train** it (web crawls take an optional User-Agent) or **Delete** it.

![Datasets tab -- Delete Dataset](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-dataset/iblai-vibe-agent-dataset-5-delete.png)

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Prerequisites

- Auth set up (`/iblai-vibe-auth`, or vibe-starter).
- `AgentSettingsProvider` wraps the route (`/iblai-vibe-agent` §1).
- `@iblai/iblai-js` ≥ 2.26 (resolves `@iblai/web-containers` 1.32). Check with
  `pnpm why @iblai/web-containers`.
- A real agent UUID. Ask the user; never invent one.

## Step 1: Check Environment

Look for `iblai.env` in the project root with `PLATFORM`, `DOMAIN`, and
`TOKEN`. If it is missing, tell the user:
"You need an `iblai.env` with your platform configuration. Download the
template and fill in your values:
`curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`"

## Step 2: Mount `AgentDatasetsTab`

**Add Resource** is gated on the RBAC grant
`/mentors/<agent db id>/documents/#create`, read from the provider's
`rbacPermissions` -- even with `enableRBAC={false}`. Without the grant the
table renders but the button never shows. Load the grants for the agent and
pass them to a nested provider:

```tsx
// app/(app)/agents/[mentorId]/datasets/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  AgentDatasetsTab,
  AgentSettingsProvider,
  useAgentSettings,
} from "@iblai/iblai-js/web-containers/next";
import {
  useGetMentorSettingsQuery,
  useGetRbacPermissionsMutation,
} from "@iblai/iblai-js/data-layer";

export default function AgentDatasetsPage() {
  const settings = useAgentSettings();
  const { tenantKey, mentorId, username } = settings;
  const [grants, setGrants] = useState<object>({});
  const [getRbacPermissions] = useGetRbacPermissionsMutation();
  const { data } = useGetMentorSettingsQuery({
    mentor: mentorId,
    org: tenantKey,
    // @ts-expect-error userId is accepted at runtime
    userId: username,
  });
  const mentorDbId = (data as { mentor_id?: number } | undefined)?.mentor_id;

  useEffect(() => {
    if (!mentorDbId) return;
    getRbacPermissions({
      requestBody: {
        platform_key: tenantKey,
        resources: [`/mentors/${mentorDbId}/documents/`],
      },
    })
      .unwrap()
      .then((permissions) => setGrants({ ...permissions }))
      .catch(() => {});
  }, [mentorDbId, tenantKey, getRbacPermissions]);

  return (
    <div className="flex h-full flex-col bg-white">
      <AgentSettingsProvider {...settings} rbacPermissions={grants}>
        <AgentDatasetsTab maxUploadSizeMb={50} />
      </AgentSettingsProvider>
    </div>
  );
}
```

The grant path uses the agent's numeric `mentor_id` from its settings, not
the UUID. If your layout already loads grants into the provider, mount
`<AgentDatasetsTab />` directly.

### Keep page and search in the URL (optional)

By default the tab keeps page and search in local state. To survive reloads
and share links, control them:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AgentDatasetsTab } from "@iblai/iblai-js/web-containers/next";

export function UrlSyncedDatasets() {
  const router = useRouter();
  const params = useSearchParams();
  const page = Number(params.get("page") ?? "1") || 1;
  const search = params.get("q") ?? "";

  const replace = (next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) sp.set(key, value);
      else sp.delete(key);
    }
    router.replace(`?${sp.toString()}`);
  };

  return (
    <AgentDatasetsTab
      page={page}
      search={search}
      onPageChange={(p) => replace({ page: String(p) })}
      onSearchChange={(q) => replace({ q: q || null, page: null })}
    />
  );
}
```

`onSearchChange` implies a reset to page 1: drop the page param in it.

## Step 3: Customize Labels (Optional)

The tab renders with the default agent-facing copy
(`AGENT_DATASETS_TAB_LABELS`, localized through the SDK's i18n). Pass a
partial `labels` object to change any string:

```tsx
import { AgentDatasetsTab } from "@iblai/iblai-js/web-containers/next";

<AgentDatasetsTab
  labels={{
    header: { title: "Knowledge base" },
    addResource: { button: "Add source" },
  }}
/>;
```

Label groups (`DatasetsTabLabels`): `header` (`title`, `description`),
`infoBox`, `search.placeholder`, `addResource.button`, `table` (the six
column headings and `emptyState`), `toasts` (`updateSuccess`, `updateError`,
`deleteSuccess`, `deleteError`, `trainQueued`, `retrainSuccess`,
`retrainError`), `deleteModal`, `trainOrDeleteModal` (including the crawler
`userAgent*` copy), and `retrainScheduleModal`. The Add Resources dialogs use
the SDK's own copy.

## Step 4: Use MCP Tools for Customization

```
get_component_info("AgentDatasetsTab")
get_component_info("AgentSettingsProvider")
```

## `<AgentDatasetsTab>` Props

Import from `@iblai/iblai-js/web-containers/next`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `labels` | `DeepPartial<DatasetsTabLabels>` | No | Override user-visible strings |
| `disabledResourceTypes` | `string[]` | No | Tile ids to hide in Add Resources (`powerpoint`, `onedrive`, `google-drive`, `dropbox`, `youtube`, `url`, `pdf`, `docx`, `excel`, `csv`, `github`, `text`, `markdown`, `audio`, ...) |
| `maxUploadSizeMb` | `number` | No | Upload size limit for local files |
| `dropboxExtensions` | `string[]` | No | File extensions the Dropbox picker offers |
| `onSelect` | `(dataset: Dataset) => void` | No | Picker mode: called when a row is clicked |
| `selectedDatasetId` | `string` | No | Picker mode: highlight this row |
| `page` | `number` | No | Controlled page (1-based). Omit for internal paging |
| `onPageChange` | `(page: number) => void` | No | Fired with the requested page when `page` is controlled |
| `search` | `string` | No | Controlled search text. Omit for internal search |
| `onSearchChange` | `(search: string) => void` | No | Fired with the debounced search; reset the page to 1 here |
| `AddResourceModal` | `ComponentType<{ isOpen, onClose, keepParentOpen? }>` | No | **Deprecated.** Replaces the built-in Add Resources dialog |
| `PaginationComponent` | `ComponentType<{ currentPage, totalPages, onPageChange, disabled }>` | No | **Deprecated.** Replaces the built-in pagination |

## Related Exports

From `@iblai/iblai-js/web-containers/next`:

- `AGENT_DATASETS_TAB_LABELS` -- the default label bundle.
- `AgentDatasetsTabProps`, `DatasetsTabLabels`, `Dataset` -- types.

## How it saves

| Action | Request |
|---|---|
| Load | `GET documents/pathways/{uuid}/?limit=5&offset=…&search=…` |
| Add a resource | `POST documents/train/` (`multipart/form-data`, `pathway` = agent UUID, `type` per source) |
| Training switch off / on | `PUT documents/{id}/` with `train: false` / `train: true` (plus `crawler_extra_headers` when a User-Agent is set) |
| Visibility (eye icon) | `PUT documents/{id}/` with `access: "public"` or `"private"` |
| Schedule Retraining | `POST documents/{id}/settings/` with `retrain_interval_days` |
| Delete | `DELETE documents/{id}/` |

All paths sit under `/api/ai-index/orgs/{org}/users/{username}/`.

## Platform data

| Hook | Purpose |
|---|---|
| `useGetTrainingDocumentsQuery` | The paged document list |
| `useEditTrainingDocumentMutation` | Train, untrain, visibility |
| `useGetMentorSettingsQuery` | The agent's `mentor_id` for the RBAC grant |

REST twin: [`/iblai-api-agent-dataset`](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-api-agent-dataset/SKILL.md).

## Step 5: Verify

Run `/iblai-vibe-ops-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors.
2. `pnpm test` -- vitest must pass.
3. `pnpm dev`, sign in, open `/agents/<uuid>/datasets`: the table renders and
   **Add Resource** shows. Add a URL, wait for its switch to turn on, then
   switch it off and **Delete** it.
4. `npx playwright screenshot http://localhost:3000/agents/<uuid>/datasets /tmp/agent-datasets.png`

## Important Notes

- **Per agent, not per user**: every trained document feeds every chat with
  the agent.
- **No Add Resource button?** The grant is missing: load
  `/mentors/<mentor_id>/documents/` permissions (Step 2).
- **Shared provider**: mount `AgentSettingsProvider` once at the layout
  level (`/iblai-vibe-agent` §1); the nested provider in Step 2 only adds
  grants.
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor`
  (`pnpm add sonner @iblai/iblai-web-mentor`).
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)