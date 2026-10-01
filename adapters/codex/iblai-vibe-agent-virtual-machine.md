# iblai-vibe-agent-virtual-machine

> Add the agent Sandbox "Network Access" section for the Virtual Machine Shell — the egress profile radio group (No Network, Package Registries, Public Internet, Custom Allowlist), the network policy picker with Create/Edit/Manage shortcuts, the secrets multi-select, and the VM billing notice. Use this when an agent runs code in a virtual machine and you need to decide what it can reach and which keys it can use. For the sandbox type selector and Claw instances see /iblai-vibe-agent-sandbox; for creating the organization's network policies and VM secrets see /iblai-vibe-virtual-machine

# /iblai-vibe-agent-virtual-machine

Add the agent Sandbox **Network Access** section -- "Decide what this
agent's virtual machine can reach and which credentials it can use."
It renders under the Sandbox Type card while **Virtual Machine Shell**
is the selected kind, and it holds three controls plus a billing
notice:

- **Egress Profile** — No Network (the default), Package Registries,
  Public Internet, Custom Allowlist.
- **Network Policy** — required under Custom Allowlist; a picker over
  the organization's policies with **Create Policy**, **Edit Policy**
  and **Manage Policies** shortcuts and the chosen policy's hosts
  listed below it.
- **Secrets** — shown under Public Internet or Custom Allowlist: a
  checkbox list of the organization's VM secrets (keys the VM can use
  but never read), capped at 20 per agent, with **Manage Secrets**.

The policies and secrets themselves are organization-wide records
managed in organization settings — see `/iblai-vibe-virtual-machine`.
This section only binds them to one agent.

![Network Access — Virtual Machine Shell on, No Network](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-virtual-machine/iblai-vibe-agent-virtual-machine.png)

![Network Access — Custom Allowlist with a policy and a secret bound](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-virtual-machine/iblai-vibe-agent-virtual-machine-custom.png)

![Network Access — Public Internet selected](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-virtual-machine/iblai-vibe-agent-virtual-machine-public.png)

![Network Access — Custom with no policy picked (Save blocked)](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-virtual-machine/iblai-vibe-agent-virtual-machine-policy-required.png)

![Create Policy — the New Network Policy dialog, opened in place](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-virtual-machine/iblai-vibe-agent-virtual-machine-create-policy.png)

![Manage Policies — the organization's Virtual Machine settings in a popup](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-virtual-machine/iblai-vibe-agent-virtual-machine-manage-policies.png)

![Manage Secrets — the same popup on the Secrets sub-tab](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-agent-virtual-machine/iblai-vibe-agent-virtual-machine-manage-secrets.png)

> **Common setup (brand, conventions, env files, verification):** see [docs/skill-setup.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/docs/skill-setup.md).

## Related surfaces

- **`/iblai-vibe-agent-sandbox`** — the Sandbox tab itself: the
  **Sandbox Type** card (Computing Runtime / Virtual Machine Shell /
  Claw) and, for Claw, instance management and the prompt files.
  `SandboxConfig` mounts this section for you.
- **`/iblai-vibe-virtual-machine`** — organization settings →
  **Virtual Machine**: the Network Policies and Secrets tables behind
  the pickers here. The **Manage Policies** / **Manage Secrets**
  buttons open that exact surface in a popup.
- **`/iblai-vibe-credential`** — the organization's integration
  credentials, which a VM secret can read its value from instead of
  storing its own.

## Prerequisites

- Auth must be set up first (`/iblai-vibe-auth`)
- MCP server + skills configured (`@iblai/mcp` in `.mcp.json`)
- Ask the user for a real `mentorId` (agent UUID). Do NOT invent one.
- The agent must have **Virtual Machine Shell** selected
  (`enable_virtual_machine: true`) — see `/iblai-vibe-agent-sandbox`.
  Nothing here applies to the Computing Runtime or Claw kinds.
- The viewer needs the `Ibl.Mentor/VirtualMachineNetworkPolicies/list`
  and `Ibl.Mentor/VirtualMachineSecrets/list` permissions to see the
  two pickers; each one hides independently on a 403.

## Step 1: Check Environment

Before proceeding, check for an `iblai.env` in the project root. Look for
`PLATFORM`, `DOMAIN`, and `TOKEN` variables. If the file does not exist or
is missing these variables, tell the user:
"You need an `iblai.env` with your platform configuration. Download the
template and fill in your values:
`curl -o iblai.env https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/iblai.env`"

## Step 2: Mount it

**You usually mount nothing.** `SandboxConfig` renders
`VirtualMachineNetworkSection` itself whenever the agent's
`enable_virtual_machine` flag is on, so following
`/iblai-vibe-agent-sandbox` Step 2 already gives you this section.

Mount it standalone only when you build your own sandbox page:

```tsx
// app/(app)/agents/[mentorId]/network/page.tsx
"use client";

import { useParams } from "next/navigation";
import { VirtualMachineNetworkSection } from "@iblai/iblai-js/web-containers";

export default function AgentNetworkPage({
  platformKey,
  username,
}: {
  platformKey: string;
  username: string;
}) {
  const { mentorId } = useParams<{ mentorId: string }>();

  return (
    <div className="flex h-full flex-col bg-white p-6">
      <VirtualMachineNetworkSection
        platformKey={platformKey}
        mentorUniqueId={mentorId}
        username={username}
      />
    </div>
  );
}
```

The component owns its own data: it reads the agent settings, the
organization's policies and the organization's secrets, keeps a local
draft, and saves through **Save Changes** / **Discard**. It does not
read `AgentSettingsProvider`, and it does **not** check
`enable_virtual_machine` — gate the mount yourself if you render it
outside `SandboxConfig`.

## Step 3: Use MCP Tools for Customization

```
get_component_info("VirtualMachineNetworkSection")
get_component_info("SandboxConfig")
get_hook_info("useListVirtualMachineNetworkPoliciesQuery")
```

## Component Props

### `<VirtualMachineNetworkSection>` — `@iblai/iblai-js/web-containers`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `platformKey` | `string` | Yes | Organization key (org slug) |
| `mentorUniqueId` | `string` | Yes | Agent UUID |
| `username` | `string` | Yes | Signed-in admin — the mentor-settings path segment, and the agent-name lookup when a policy delete is refused |

## What the section renders

### Billing notice

A grey note above the controls: *"Virtual machine time is billed to
the chatting user's credits: $1 per 10 minutes by default, prorated
per second. Your organization's rate may differ."* The figures come
from `VIRTUAL_MACHINE_DEFAULT_BILLING` (`{ usd: 1, minutes: 10 }`);
the real rate is configurable per organization.

### Egress Profile

Four radio cards, each with a label and one line of explanation:

| Profile | Wire value | Reachability |
|---|---|---|
| No Network | `none` (default) | The VM cannot reach anything |
| Package Registries | `registries` | PyPI, npm, apt and apk only, for installing packages |
| Public Internet | `public` | Any public host; private networks, localhost and cloud metadata stay blocked |
| Custom Allowlist | `custom` | Only the hosts in the network policy picked below |

### Network Policy (Custom Allowlist only)

- A **select** over the organization's policies, plus **Create
  Policy** (opens `NetworkPolicyDialog` in place and selects the new
  policy on save), **Edit Policy** (same dialog for the current
  selection) and **Manage Policies**.
- Below the select, **"Hosts this policy allows:"** with the policy's
  `host:port` entries as chips.
- With nothing picked, *"The Custom profile needs a network policy."*
  shows in red and **Save Changes** stays disabled.
- Empty organization → the select reads *"No network policies yet"*
  and is disabled; use **Create Policy**.
- No list permission → the whole picker is replaced by a line saying
  the profile cannot be configured from here.

### Secrets (Public Internet or Custom Allowlist only)

- *"Keys the VM can use but never read. Up to 20 per agent."*
- One checkbox per organization secret showing its name, its
  environment variable as a code chip, and the hosts it may be sent
  to. At 20 checked, the unchecked boxes disable and a note says the
  cap is reached.
- **Manage Secrets** opens the organization surface on its Secrets
  sub-tab.
- No secrets in the organization → *"Your organization has no VM
  secrets yet. Use Manage Secrets to create one."*
- No list permission → the whole Secrets block is hidden.

### Manage Policies / Manage Secrets popup

Both buttons open a wide dialog titled **Virtual Machine Settings**
("Network policies and VM secrets are shared by every agent in your
organization.") hosting the same `VirtualMachineAdminTab` the
organization settings page uses, opened on the matching sub-tab — so
an admin never leaves the agent to create what they need here.

## Rules the section enforces before saving

These mirror the backend; getting them wrong is a 400.

| Situation | What happens |
|---|---|
| Custom Allowlist with no policy | Save disabled, inline red message |
| Narrowing to No Network / Package Registries while secrets are bound | An **Unbind Secrets?** dialog; confirming sends `virtual_machine_secret_ids: []` in the same request |
| A bound secret needs a host the chosen policy does not allow | An amber panel lists each `env_var` → missing hosts, with **Add Hosts to {policy} and Save** — one PATCH on the policy, then the settings save |
| More than 20 secrets | Not reachable; the checkboxes disable at the cap |
| Backend 400 | Field errors land under the matching control (`virtual_machine_egress`, `virtual_machine_network_policy_id`, `virtual_machine_secret_ids`); anything else becomes a form-level message |
| Backend 403 on save | "You do not have permission to change these settings." |

Only the keys that actually changed are sent, and the save goes
through `useEditMentorJsonMutation` — **not** the multipart
`useEditMentorMutation`, which drops an empty list and a `null`, so
"unbind every secret" and "clear the policy" would never reach the
backend. Mirror that choice in custom UI.

## Agent settings fields

Read from `GET`, written with `PUT` on
`${dmUrl}/api/ai-mentor/orgs/{org}/users/{username}/mentors/{mentor_unique_id}/settings/`
(a partial update — send only what changes).

| Field | Read shape | Write shape |
|---|---|---|
| `virtual_machine_egress` | `"none" \| "registries" \| "public" \| "custom"` | same |
| `virtual_machine_network_policy` | `{ id, name, allowed_hosts }` or `null` | written as `virtual_machine_network_policy_id: number \| null` |
| `virtual_machine_secrets` | `[{ id, name, env_var, allow_hosts, source_credential_id }]` | written as `virtual_machine_secret_ids: number[]` — replaces the whole set, `[]` unbinds all |

The policy and secret CRUD endpoints themselves are documented in
`/iblai-vibe-virtual-machine`.

## Related Exports

From `@iblai/iblai-js/web-containers`:

- `VirtualMachineNetworkSection`, `VirtualMachineNetworkSectionProps` —
  this section.
- `SandboxConfig` — the Sandbox tab that mounts it (see
  `/iblai-vibe-agent-sandbox`).
- `VirtualMachineAdminTab` — what **Manage Policies** / **Manage
  Secrets** render inside the popup (`defaultTab` picks the sub-tab).
- `HostPortChipInput`, `HostPortChipInputProps` — the `host:port` chip
  input the policy dialog uses; reusable for any allowlist field.

From `@iblai/iblai-js/data-layer`:

- `useGetMentorSettingsQuery`, `useEditMentorJsonMutation` — read and
  write the three agent fields above.
- `useListVirtualMachineNetworkPoliciesQuery`,
  `useUpdateVirtualMachineNetworkPolicyMutation` — the picker's
  options and the "add the missing hosts" PATCH.
- `useListVirtualMachineSecretsQuery` — the secrets checkboxes.
- `VIRTUAL_MACHINE_EGRESS_PROFILES`,
  `VIRTUAL_MACHINE_MAX_SECRETS_PER_MENTOR` (20),
  `VIRTUAL_MACHINE_DEFAULT_BILLING` (`{ usd: 1, minutes: 10 }`) — the
  constants the UI is built from.
- `isVirtualMachineEgressNetworked` — true for `public` and `custom`
  (the profiles that may carry secrets).
- `findUncoveredSecretHosts` — the bound-secret-vs-policy check behind
  the amber panel.
- `getVirtualMachineApiError`, `getVirtualMachineErrorStatus` —
  normalise a 400 into `{ message, fieldErrors }` and read the status
  off an RTK Query error.
- Types: `VirtualMachineEgress`, `MentorVirtualMachineSettings`,
  `MentorVirtualMachineSettingsUpdate`, `VirtualMachineNetworkPolicy`,
  `VirtualMachineSecret`, `VirtualMachineUncoveredSecretHosts`.

SDK source: `packages/web-containers/src/components/claw-sandbox/virtual-machine-network-section.tsx`,
with the shared dialog at `components/virtual-machine/network-policy-dialog.tsx`
and the data layer under `packages/data-layer/src/features/virtual-machine/`.

## Step 4: Verify

Run `/iblai-vibe-ops-test` before telling the user the work is ready:

1. `pnpm build` -- must pass with zero errors
2. `pnpm test` -- vitest must pass
3. Start dev server and touch test:
   ```bash
   pnpm dev &
   npx playwright screenshot http://localhost:3000/agents/<id>/sandbox /tmp/agent-vm-network.png
   ```

## Important Notes

- **Redux store**: Must include `mentorReducer` and `mentorMiddleware`
  (they register `virtualMachineApiSlice`)
- **`initializeDataLayer()`**: 5 args (v1.2+)
- **`@reduxjs/toolkit`**: Deduplicated via webpack aliases in `next.config.ts`
- **Peer deps**: `sonner` and `@iblai/iblai-web-mentor` must be installed
  (`pnpm add sonner @iblai/iblai-web-mentor`)
- **No network is the default.** A new agent on Virtual Machine Shell
  reaches nothing until someone picks a profile here. Treat that as
  the feature, not a gap.
- **Secrets are for the VM, not the agent.** Inside the machine the
  environment variable holds a placeholder; the real value is
  substituted only on TLS requests to the secret's `allow_hosts`. The
  agent never sees it, and no endpoint ever returns it.
- **Secrets need a networked profile.** They only appear under Public
  Internet and Custom Allowlist, and narrowing the profile unbinds
  them — with a confirmation first.
- **Two independent 403s.** The policy picker and the Secrets block
  gate on their own list permission. One can be visible while the
  other is not; the save itself can still 403 separately.
- **Policies are shared.** Editing a policy from here changes it for
  every agent bound to it, and the edit dialog warns when you remove a
  host a bound secret still needs.
- **`mentorUniqueId` vs `mentorId`**: these endpoints key on the
  agent's UUID, not the integer pk — the same UUID as the rest of the
  agent-* family.
- **Brand guidelines**: [BRAND.md](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/BRAND.md)