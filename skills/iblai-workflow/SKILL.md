---
name: iblai-workflow
description: Add workflow builder components to your Next.js app
globs:
alwaysApply: false
---

# /iblai-workflow

Add AI workflow builder features -- a visual workflow editor with a node type
browser sidebar, tool configuration dialogs, connector management, and
create/delete workflow modals.

> **AI Assistant:**
> Do NOT add custom styles, colors, or CSS overrides to ibl.ai SDK components.
> They ship with their own styling. Keep the components as-is.
> Do NOT implement dark mode unless the user explicitly asks for it.
>
> When building custom UI around SDK components, use the ibl.ai brand:
> - **Primary**: `#0058cc`, **Gradient**: `linear-gradient(135deg, #00b0ef, #0058cc)`
> - **Button**: `bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white`
> - **Font**: System sans-serif stack, **Style**: shadcn/ui new-york variant
> - Use shadcn components for custom UI -- they share the same Tailwind
>   theme and render in ibl.ai brand colors automatically.
>
> You MUST run `/iblai-test` before telling the user the work is ready.

## Prerequisites

- Auth must be set up first (`/iblai-auth`)
- MCP and skills must be set up: `iblai add mcp`

## Step 0: Check for CLI Updates

> **AI Assistant:** Before running any `iblai` command, check for updates.
> Run `iblai --version` to get the current version, then check the latest:
> - **PyPI:** `curl -sf https://pypi.org/pypi/iblai-app-cli/json | python3 -c "import sys,json; print(json.load(sys.stdin)['info']['version'])"`
> - **npm:** `npm view @iblai/cli version 2>/dev/null`
> - **GitHub (binary installs):** `curl -sf https://api.github.com/repos/iblai/iblai-app-cli/releases/latest | python3 -c "import sys,json; print(json.load(sys.stdin)['tag_name'].lstrip('v'))"`
>
> If a newer version exists, update:
> - pip: `pip install --upgrade iblai-app-cli`
> - npm: `npm install -g @iblai/cli@latest`
> - Binary: download the latest release from `https://github.com/iblai/iblai-app-cli/releases/latest` for the current platform and replace the binary

## Step 1: Add the Components

There is no dedicated CLI generator for workflow components. Import them
directly from the SDK:

```typescript
import {
  WorkflowSidebar,
  ToolDialogs,
  ConnectorManagementDialog,
  CreateWorkflowModal,
  DeleteWorkflowModal,
} from "@iblai/iblai-js/web-containers";
```

## Step 2: Use MCP Tools for Customization

```
get_component_info("WorkflowSidebar")
get_component_info("ToolDialogs")
get_component_info("ConnectorManagementDialog")
get_component_info("CreateWorkflowModal")
get_component_info("DeleteWorkflowModal")
```

## Components

### `<WorkflowSidebar>`

Node type browser sidebar for the workflow editor. Lists available node types
(actions, conditions, triggers) that can be dragged onto the canvas.

| Prop | Type | Description |
|------|------|-------------|
| `org` | `string` | Tenant/org key |

### `<ToolDialogs>`

Configuration dialogs for workflow tools/nodes. Opens when a user clicks
a node to configure its parameters.

| Prop | Type | Description |
|------|------|-------------|
| `org` | `string` | Tenant/org key |

### `<ConnectorManagementDialog>`

Dialog for setting up and managing external service connectors (APIs,
databases, third-party integrations) used by workflow nodes.

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | `boolean` | Whether the dialog is visible |
| `onClose` | `() => void` | Close callback |
| `org` | `string` | Tenant/org key |

### `<CreateWorkflowModal>`

Modal dialog to create a new workflow with a name and optional description.

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | `boolean` | Whether the modal is visible |
| `onClose` | `() => void` | Close callback |
| `org` | `string` | Tenant/org key |
| `onCreate` | `(workflow) => void` | Callback after workflow is created |

### `<DeleteWorkflowModal>`

Confirmation modal for deleting a workflow.

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | `boolean` | Whether the modal is visible |
| `onClose` | `() => void` | Close callback |
| `workflowId` | `string` | ID of the workflow to delete |
| `onDelete` | `() => void` | Callback after deletion |

## Example Usage

A workflow builder page with sidebar and create/delete modals:

```tsx
"use client";
import { useState } from "react";
import {
  WorkflowSidebar,
  CreateWorkflowModal,
  DeleteWorkflowModal,
  ConnectorManagementDialog,
} from "@iblai/iblai-js/web-containers";
import { Button } from "@/components/ui/button";
import { resolveAppTenant } from "@/lib/iblai/tenant";

export default function WorkflowsPage() {
  const tenant = resolveAppTenant();
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [showConnectors, setShowConnectors] = useState(false);

  return (
    <div className="flex h-screen">
      <WorkflowSidebar org={tenant} />
      <div className="flex-1 p-6">
        <div className="flex gap-2 mb-4">
          <Button onClick={() => setShowCreate(true)}>New Workflow</Button>
          <Button variant="outline" onClick={() => setShowConnectors(true)}>
            Connectors
          </Button>
        </div>
        {/* Workflow canvas goes here */}
      </div>
      <CreateWorkflowModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        org={tenant}
        onCreate={(wf) => {
          setShowCreate(false);
          // Navigate to workflow editor
        }}
      />
      {showDelete && (
        <DeleteWorkflowModal
          isOpen={true}
          onClose={() => setShowDelete(null)}
          workflowId={showDelete}
          onDelete={() => setShowDelete(null)}
        />
      )}
      <ConnectorManagementDialog
        isOpen={showConnectors}
        onClose={() => setShowConnectors(false)}
        org={tenant}
      />
    </div>
  );
}
```

## Step 3: Verify

Run `/iblai-test` before telling the user the work is ready:

1. `npm run build` -- must pass with zero errors
2. Start dev server and verify the workflow page renders:
   ```bash
   npm run dev &
   npx playwright screenshot http://localhost:3000/workflows /tmp/workflows.png
   ```

## Important Notes

- **Import**: `@iblai/iblai-js/web-containers` -- framework-agnostic
- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Brand guidelines**: [BRAND.md](https://github.com/iblai/vibe/blob/main/BRAND.md)
